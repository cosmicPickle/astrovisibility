package com.cosmicpickle.astrovisibility.panorama

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.*
import android.hardware.camera2.*
import android.media.Image
import android.media.ImageReader
import android.os.Handler
import android.os.SystemClock
import android.util.Size
import android.view.Surface
import android.view.TextureView
import kotlin.math.*

/** Camera2 owns a smooth preview and a latest-image-only analysis stream. */
internal class ContinuousCameraStream(
  private val context: Context, private val texture: TextureView, private val worker: Handler,
  private val onFrame: (Image, Int, Double, Double, Long) -> Unit,
  private val onError: () -> Unit,
) {
  private var device: CameraDevice? = null
  private var session: CameraCaptureSession? = null
  private var reader: ImageReader? = null
  private var surface: Surface? = null
  @Volatile private var closed = false
  private var streamSize = Size(1280, 960)
  private var rotationDegrees = 90

  @SuppressLint("MissingPermission")
  fun open() {
    try {
      val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
      val id = manager.cameraIdList.first { manager.getCameraCharacteristics(it)
        .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK }
      val camera = manager.getCameraCharacteristics(id)
      val outputs = camera.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)!!
      val previewSizes = outputs.getOutputSizes(SurfaceTexture::class.java).toSet()
      val sizes = outputs.getOutputSizes(ImageFormat.YUV_420_888).filter {
        it.width <= 1280 && it.height <= 1280 && it.width >= 640 && previewSizes.contains(it)
      }
      require(sizes.isNotEmpty())
      streamSize = sizes.minBy { abs(it.width.toDouble() / it.height - 4.0 / 3) * 10000 - it.width }
      rotationDegrees = camera.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90
      require(rotationDegrees == 90 || rotationDegrees == 270) { "Unsupported portrait sensor" }
      val physical = camera.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)!!
      val focal = camera.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)!!.minBy {
        abs(Math.toDegrees(2 * atan(physical.width / (2.0 * it))) - 70)
      }.toDouble()
      // Center crop the active sensor to the analysis/preview stream aspect.
      val ratio = streamSize.width.toDouble() / streamSize.height
      val sensorWidth = min(physical.width.toDouble(), physical.height * ratio)
      val sensorHeight = min(physical.height.toDouble(), physical.width / ratio)
      val horizontal = Math.toDegrees(2 * atan(sensorHeight / (2 * focal)))
      val vertical = Math.toDegrees(2 * atan(sensorWidth / (2 * focal)))
      require(horizontal in 10.0..140.0 && vertical in 10.0..140.0)
      val realtime = camera.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE) ==
        CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME
      val cameraReader = ImageReader.newInstance(streamSize.width, streamSize.height, ImageFormat.YUV_420_888, 2)
      reader = cameraReader
      cameraReader.setOnImageAvailableListener({ source ->
        val image = try { source.acquireLatestImage() } catch (_: Exception) { null }
        if (image != null) try {
          if (!closed) onFrame(image, rotationDegrees, horizontal, vertical,
            if (realtime) image.timestamp else SystemClock.elapsedRealtimeNanos())
        } catch (_: Exception) { if (!closed) onError() } finally { image.close() }
      }, worker)
      val previewTexture = texture.surfaceTexture ?: error("Camera surface unavailable")
      previewTexture.setDefaultBufferSize(streamSize.width, streamSize.height)
      surface = Surface(previewTexture)
      texture.post { updateTransform() }
      manager.openCamera(id, object : CameraDevice.StateCallback() {
        override fun onOpened(cameraDevice: CameraDevice) {
          if (closed) { cameraDevice.close(); return }
          device = cameraDevice
          try {
            val targets = listOf(surface!!, cameraReader.surface)
            cameraDevice.createCaptureSession(targets, object : CameraCaptureSession.StateCallback() {
              override fun onConfigured(captureSession: CameraCaptureSession) {
                if (closed) { captureSession.close(); return }
                session = captureSession
                try {
                  val request = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                    targets.forEach { addTarget(it) }
                    set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                    set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
                    set(CaptureRequest.LENS_FOCAL_LENGTH, focal.toFloat())
                    set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE, CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_OFF)
                    set(CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE, CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF)
                  }.build()
                  captureSession.setRepeatingRequest(request, null, worker)
                } catch (_: Exception) { if (!closed) onError() }
              }
              override fun onConfigureFailed(captureSession: CameraCaptureSession) { if (!closed) onError() }
            }, worker)
          } catch (_: Exception) { if (!closed) onError() }
        }
        override fun onDisconnected(cameraDevice: CameraDevice) { cameraDevice.close(); if (!closed) onError() }
        override fun onError(cameraDevice: CameraDevice, error: Int) { cameraDevice.close(); if (!closed) onError() }
      }, worker)
    } catch (_: Exception) { if (!closed) onError() }
  }

  fun updateTransform() {
    val width = texture.width.toFloat(); val height = texture.height.toFloat()
    if (width <= 0 || height <= 0) return
    texture.setTransform(capturePreviewTransform(width, height, streamSize))
  }

  fun close() {
    closed = true
    worker.post {
      session?.close(); device?.close(); reader?.close(); surface?.release()
      session = null; device = null; reader = null; surface = null
    }
  }
}

internal fun capturePreviewTransform(width: Float, height: Float, streamSize: Size): Matrix {
  // TextureView already applies SENSOR_ORIENTATION. The app is portrait locked;
  // only restore the rotated buffer's aspect ratio, without rotating it again.
  // https://developer.android.com/media/camera/camera2/camera-preview#textureview
  val scale = min(width / streamSize.height, height / streamSize.width)
  return Matrix().apply {
    setScale(streamSize.height * scale / width, streamSize.width * scale / height, width / 2, height / 2)
  }
}
