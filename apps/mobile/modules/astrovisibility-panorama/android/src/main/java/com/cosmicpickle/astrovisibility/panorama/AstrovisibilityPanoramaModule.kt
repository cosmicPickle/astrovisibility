package com.cosmicpickle.astrovisibility.panorama

import androidx.annotation.Keep
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@Keep
class AstrovisibilityPanoramaModule : Module() {
  private data class Job(val id: String, val cancelled: AtomicBoolean = AtomicBoolean(false))
  private val worker = Executors.newSingleThreadExecutor()
  @Volatile private var activeJob: Job? = null
  @Volatile private var destroyed = false
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
  private val root get() = File(context.cacheDir, "panorama-stitching")

  override fun definition() = ModuleDefinition {
    Name("AstrovisibilityPanorama")
    Events("onProgress")
    AsyncFunction("licences") {
      val assets = context.assets
      assets.list("opencv-licenses")!!.sorted().joinToString("\n\n") { name ->
        "$name\n\n" + assets.open("opencv-licenses/$name").bufferedReader().use { it.readText() }
      }
    }
    AsyncFunction("clearCache") { promise: Promise ->
      val cacheRoot = root
      activeJob?.let { it.cancelled.set(true); cancelNative(it.id) }
      worker.execute {
        if (!cacheRoot.exists() || cacheRoot.deleteRecursively()) promise.resolve(null)
        else promise.reject("ERR_PANORAMA_CACHE", "Panorama cache could not be cleared", null)
      }
    }
    OnCreate {
      System.loadLibrary("opencv_java4")
      System.loadLibrary("astrovisibility_panorama")
    }
    AsyncFunction("stitch") { jobId: String, tiles: String, useReviewedPlacements: Boolean, promise: Promise ->
      val job = synchronized(this@AstrovisibilityPanoramaModule) {
        require(!destroyed && activeJob == null) { "Panorama processing is busy" }
        require(jobId.matches(Regex("[A-Za-z0-9-]{1,100}"))) { "Invalid panorama job" }
        Job(jobId).also { activeJob = it }
      }
      val appContext = context.applicationContext
      val cacheRoot = root
      worker.execute {
        val directory = File(cacheRoot, job.id)
        var created = false
        try {
          cacheRoot.mkdirs()
          // Only our generated cache directories, never a caller-supplied path.
          cacheRoot.listFiles()?.filter {
            it.name != job.id && it.lastModified() < System.currentTimeMillis() - 86_400_000
          }?.forEach { it.deleteRecursively() }
          require(!directory.exists() && directory.mkdirs())
          created = true
          val check = { check(!job.cancelled.get() && !destroyed) }
          val inputs = prepareInputs(appContext, tiles, directory, check) { done, total ->
            reportProgress(job.id, "reading", done, total)
          }
          check()
          val prefix = File(directory, "panorama").path
          val result = stitchNative(job.id, inputs.paths, inputs.placements, prefix, useReviewedPlacements)
          check(result.size == 1 + inputs.placements.size && result.all { it.isFinite() })
          check()
          inputs.paths.forEach { File(it).delete() }
          synchronized(this@AstrovisibilityPanoramaModule) {
            check()
            activeJob = null
          }
          promise.resolve(mapOf(
            "uri" to File("$prefix.png").toURI().toString(),
            "coverageUri" to File("$prefix.coverage").toURI().toString(),
            "unmatchedCount" to result[0].toInt(),
            "placements" to inputs.paths.indices.map { index ->
              val offset = 1 + index * 5
              mapOf("centerAzimuthDegrees" to result[offset],
                "centerAltitudeDegrees" to result[offset + 1],
                "rollDegrees" to result[offset + 2],
                "horizontalFieldOfViewDegrees" to result[offset + 3],
                "verticalFieldOfViewDegrees" to result[offset + 4])
            }
          ))
        } catch (_: Exception) {
          if (created) directory.deleteRecursively()
          promise.reject("ERR_PANORAMA", "The photos could not be stitched. Your capture draft is safe.", null)
        } finally {
          synchronized(this@AstrovisibilityPanoramaModule) {
            if (activeJob === job) activeJob = null
          }
        }
      }
    }
    Function("cancel") { jobId: String ->
      activeJob?.takeIf { it.id == jobId }?.let {
        it.cancelled.set(true)
        cancelNative(jobId)
      }
    }
    AsyncFunction("discard") { jobId: String ->
      require(jobId.matches(Regex("[A-Za-z0-9-]{1,100}")))
      synchronized(this@AstrovisibilityPanoramaModule) {
        val job = activeJob
        if (job?.id == jobId) {
          job.cancelled.set(true)
          cancelNative(jobId)
        } else {
          File(root, jobId).deleteRecursively()
        }
      }
    }
    OnDestroy {
      destroyed = true
      activeJob?.let { it.cancelled.set(true); cancelNative(it.id) }
      worker.shutdown()
    }
  }

  @Keep
  fun isJobCancelled(jobId: String): Boolean = destroyed ||
    activeJob?.let { it.id != jobId || it.cancelled.get() } != false

  @Keep
  fun reportProgress(jobId: String, stage: String, completed: Int, total: Int) {
    if (!destroyed) sendEvent("onProgress", mapOf(
      "jobId" to jobId, "stage" to stage, "completed" to completed, "total" to total
    ))
  }

  private external fun stitchNative(jobId: String, paths: Array<String>, placements: DoubleArray, prefix: String,
    useReviewedPlacements: Boolean): DoubleArray
  private external fun cancelNative(jobId: String)
}
