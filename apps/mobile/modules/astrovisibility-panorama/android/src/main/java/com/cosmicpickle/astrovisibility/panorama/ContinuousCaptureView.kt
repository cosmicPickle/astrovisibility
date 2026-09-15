package com.cosmicpickle.astrovisibility.panorama

import android.content.Context
import android.graphics.Bitmap
import android.graphics.SurfaceTexture
import android.hardware.GeomagneticField
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.view.TextureView
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import java.io.File
import java.util.UUID

class ContinuousCaptureView(context: Context, appContext: AppContext) : ExpoView(context, appContext),
  TextureView.SurfaceTextureListener, LifecycleEventListener {
  private val texture = TextureView(context)
  private val thread = HandlerThread("panorama-capture").apply { start() }
  private val worker = Handler(thread.looper)
  private val sensor = CaptureSensor(context)
  private val tracker = ContinuousTracker()
  private var camera: ContinuousCameraStream? = null
  private var seeded = false
  private var initialTiles = "[]"
  private var lastFrame = 0L
  private var sequence = 0
  private var pending: Pair<Int, TrackedCapture>? = null
  private var pendingFile: File? = null
  @Volatile private var recording = false
  @Volatile private var foreground = false
  @Volatile private var disposed = false
  private val cacheDirectory = File(context.cacheDir, "continuous-panorama")
  val onTracking by EventDispatcher()
  val onFrame by EventDispatcher()
  val onStopped by EventDispatcher()
  val onInterruption by EventDispatcher()
  override val shouldUseAndroidLayout = true

  init {
    setBackgroundColor(android.graphics.Color.BLACK)
    texture.surfaceTextureListener = this
    addView(texture, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun configureObserver(observer: Map<String, Double>) {
    val latitude = observer["latitudeDegreesNorth"] ?: return
    val longitude = observer["longitudeDegreesEast"] ?: return
    val elevation = observer["elevationMetersAboveMeanSeaLevel"] ?: 0.0
    require(latitude in -90.0..90.0 && longitude in -180.0..180.0 && elevation.isFinite())
    sensor.declinationRadians = Math.toRadians(GeomagneticField(latitude.toFloat(), longitude.toFloat(),
      elevation.toFloat(), System.currentTimeMillis()).declination.toDouble())
  }
  fun setInitialTiles(value: String) { if (!seeded) { require(value.length < 2_000_000); initialTiles = value } }
  fun setRecording(value: Boolean) {
    if (disposed) return
    val wasRecording = recording
    recording = value
    if (value) openCamera()
    if (!value && wasRecording) worker.post { emit { onStopped(emptyMap<String, Any>()) } }
  }
  fun acknowledge(sequence: Int) {
    if (disposed) return
    worker.post {
      pending?.takeIf { it.first == kotlin.math.abs(sequence) }?.let {
        if (sequence > 0) tracker.retain(it.second) else it.second.close()
        pending = null; pendingFile?.delete(); pendingFile = null
      }
    }
  }
  private fun emit(action: () -> Unit) { post { if (!disposed) action() } }
  private fun status(value: String) = emit { onTracking(mapOf("status" to value)) }
  private fun interrupt() {
    recording = false
    emit { onInterruption(emptyMap<String, Any>()) }
    camera?.close(); camera = null; sensor.stop()
  }
  private fun openCamera() {
    if (disposed || !foreground || camera != null || !texture.isAvailable) return
    if (!sensor.start()) { status("sensor"); return }
    camera = ContinuousCameraStream(context, texture, worker, { image, rotation, horizontal, vertical, timestamp ->
      if (!recording || disposed || SystemClock.elapsedRealtimeNanos() - lastFrame < 200_000_000) return@ContinuousCameraStream
      lastFrame = SystemClock.elapsedRealtimeNanos()
      if (!seeded) { seedDraft(); seeded = true }
      val basis = sensor.at(timestamp)
      if (basis == null) { status("sensor"); return@ContinuousCameraStream }
      val gray = captureGray(image, rotation)
      var tracked: TrackedCapture? = null
      try {
        tracked = tracker.analyze(gray, basis, horizontal, vertical)
        val frame = tracked
        val pose = CaptureBasis.pose(frame.basis, timestamp, sensor.currentAccuracy)
        val sensorPose = CaptureBasis.pose(basis, timestamp, sensor.currentAccuracy)
        emit { onTracking(mapOf("status" to frame.status, "pose" to pose,
          "sensorPose" to sensorPose,
          "horizontalDegrees" to horizontal, "verticalDegrees" to vertical)) }
        if (frame.accept && pending == null) {
          cacheDirectory.mkdirs()
          val file = File(cacheDirectory, "${UUID.randomUUID()}.jpg")
          val bitmap = captureBitmap(image, rotation)
          try { file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.JPEG, 88, it)) } }
          catch (error: Exception) { file.delete(); throw error }
          finally { bitmap.recycle() }
          sequence++
          val id = sequence
          val width = image.height
          val height = image.width
          pending = id to frame; pendingFile = file; tracked = null
          emit { onFrame(mapOf("sequence" to id, "uri" to file.toURI().toString(),
            "widthPixels" to width, "heightPixels" to height,
            "horizontalDegrees" to horizontal, "verticalDegrees" to vertical, "pose" to pose,
            "sensorPose" to sensorPose)) }
        }
      } finally { tracked?.close(); gray.release() }
    }, {
      recording = false
      emit {
        camera?.close(); camera = null; sensor.stop()
        onTracking(mapOf("status" to "error"))
      }
    }).also { it.open() }
  }

  private fun seedDraft() {
    val entries = JSONArray(initialTiles)
    require(entries.length() <= 200)
    cacheDirectory.mkdirs()
    cacheDirectory.listFiles()?.filter { it.lastModified() < System.currentTimeMillis() - 86_400_000 }
      ?.forEach { it.delete() }
    for (index in 0 until minOf(entries.length(), 96)) {
      val entry = entries.getJSONObject(index)
      val gray = readCaptureSeed(context, entry.getString("uri"))
      try {
        val placement = entry.getJSONObject("reviewedPlacement")
        tracker.seed(gray, CaptureBasis.fromPlacement(placement.getDouble("centerAzimuthDegrees"),
          placement.getDouble("centerAltitudeDegrees"), placement.getDouble("rollDegrees")),
          placement.getDouble("horizontalFieldOfViewDegrees"), placement.getDouble("verticalFieldOfViewDegrees"))
      } finally { gray.release() }
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow(); (appContext.reactContext as? ReactContext)?.addLifecycleEventListener(this); openCamera()
  }
  override fun onDetachedFromWindow() {
    disposed = true; recording = false
    (appContext.reactContext as? ReactContext)?.removeLifecycleEventListener(this)
    camera?.close(); camera = null; sensor.stop()
    // A JS copy may still own the pending file. Acknowledged files are removed
    // immediately; interrupted files are age-cleaned on the next session.
    worker.post { pending?.second?.close(); pending = null; tracker.close(); thread.quitSafely() }
    super.onDetachedFromWindow()
  }
  override fun onHostPause() { foreground = false; interrupt() }
  override fun onHostResume() { foreground = true; openCamera() }
  override fun onHostDestroy() { foreground = false; interrupt() }
  override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) = openCamera()
  override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) { camera?.updateTransform() }
  override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean { interrupt(); return true }
  override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
}
