package com.cosmicpickle.astrovisibility.panorama

import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import org.opencv.android.Utils
import org.opencv.core.Mat
import org.opencv.core.Point
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

/** Ephemeral editor processing; persistence remains in the existing repository. */
class MaskEditingModule : Module() {
  private val worker = Executors.newSingleThreadExecutor()
  private val session = AtomicReference<String?>(null)
  @Volatile private var busy = false
  @Volatile private var destroyed = false
  private var prepared: ConnectedMaskSelection? = null
  private var preparedKey: String? = null
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AstrovisibilityMaskEditing")
    OnCreate { System.loadLibrary("opencv_java4") }
    Function("begin") { id: String ->
      require(id.matches(Regex("[A-Za-z0-9-]{1,100}")))
      check(!destroyed)
      session.set(id)
    }
    AsyncFunction("select") { id: String, uri: String, width: Int, height: Int, json: String, promise: Promise ->
      require(width in 1..2048 && height in 1..2048 && json.length <= 500_000)
      synchronized(this@MaskEditingModule) {
        check(!destroyed && session.get() == id && !busy)
        busy = true
      }
      val appContext = context.applicationContext
      val cacheRoot = File(appContext.cacheDir, "mask-editing")
      worker.execute {
        try {
          val deadlineNanos = System.nanoTime() + 5_000_000_000L
          val checkCancelled = { check(!destroyed && session.get() == id && System.nanoTime() <= deadlineNanos) }
          checkCancelled()
          val request = JSONObject(json)
          val entries = request.getJSONArray("points")
          require(entries.length() in 1..4096)
          val points = (0 until entries.length()).map {
            val point = entries.getJSONArray(it)
            require(point.length() == 2)
            Point(point.getDouble(0), point.getDouble(1))
          }
          val values = request.getJSONArray("view")
          require(values.length() == 12)
          val footprint = selectProjectedMaskBrush(width, height,
            DoubleArray(12) { values.getDouble(it) }, points,
            request.getDouble("radius"), checkCancelled)
          val selected = if (request.getString("mode") == "magic") {
            val sourceUri = Uri.parse(uri)
            require(sourceUri.scheme == "file")
            val source = File(requireNotNull(sourceUri.path)).canonicalFile
            require(source.path.startsWith(appContext.filesDir.canonicalPath + File.separator) ||
              source.path.startsWith(appContext.cacheDir.canonicalPath + File.separator))
            require(source.isFile && source.length() in 1..32L * 1024 * 1024)
            val key = "$id:${source.path}:${source.lastModified()}:$width:$height"
            if (preparedKey != key) {
              prepared?.close()
              prepared = null
              preparedKey = null
              val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
              BitmapFactory.decodeFile(source.path, bounds)
              require(bounds.outWidth == width && bounds.outHeight == height)
              checkCancelled()
              val bitmap = requireNotNull(BitmapFactory.decodeFile(source.path))
              val rgba = Mat()
              try {
                Utils.bitmapToMat(bitmap, rgba, true)
                prepared = ConnectedMaskSelection(rgba)
                preparedKey = key
              } finally {
                bitmap.recycle()
                rgba.release()
              }
            }
            requireNotNull(prepared).selectBrush(footprint, checkCancelled)
          } else {
            require(request.getString("mode") == "manual")
            footprint
          }
          checkCancelled()
          cacheRoot.mkdirs()
          val directory = File(cacheRoot, id)
          directory.mkdirs()
          val output = File(directory, "selection.bits")
          output.writeBytes(selected)
          checkCancelled()
          promise.resolve(output.toURI().toString())
        } catch (_: Exception) {
          promise.reject("ERR_MASK_SELECTION", "The brush could not be applied. Your edits are safe.", null)
        } finally {
          busy = false
        }
      }
    }
    AsyncFunction("end") { id: String, promise: Promise ->
      require(id.matches(Regex("[A-Za-z0-9-]{1,100}")))
      session.compareAndSet(id, null)
      val cacheRoot = File(context.cacheDir, "mask-editing")
      worker.execute {
        if (preparedKey?.startsWith("$id:") == true) {
          prepared?.close()
          prepared = null
          preparedKey = null
        }
        File(cacheRoot, id).deleteRecursively()
        promise.resolve(null)
      }
    }
    OnDestroy {
      destroyed = true
      session.set(null)
      worker.execute { prepared?.close(); prepared = null; preparedKey = null }
      worker.shutdown()
    }
  }
}
