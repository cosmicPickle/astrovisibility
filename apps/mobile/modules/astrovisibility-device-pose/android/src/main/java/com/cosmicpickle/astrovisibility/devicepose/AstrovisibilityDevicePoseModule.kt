package com.cosmicpickle.astrovisibility.devicepose

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener2
import android.hardware.SensorManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Bundle
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.sin

private const val FALLBACK_HORIZONTAL_FOV_DEGREES = 55.0
private const val FALLBACK_VERTICAL_FOV_DEGREES = 69.0

class AstrovisibilityDevicePoseModule : Module(), SensorEventListener2 {
  private val rotationMatrix = FloatArray(9)
  private var declinationRadians = 0.0
  private var sensorAccuracy = SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM
  private var isObserving = false

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val sensorManager: SensorManager
    get() = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

  private val rotationVectorSensor: Sensor?
    get() = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

  override fun definition() = ModuleDefinition {
    Name("AstrovisibilityDevicePose")
    Events("onPoseChanged")

    AsyncFunction<Boolean>("isAvailableAsync") {
      rotationVectorSensor != null
    }

    AsyncFunction("configureObserverAsync") {
        latitudeDegreesNorth: Double,
        longitudeDegreesEast: Double,
        elevationMetersAboveMeanSeaLevel: Double,
        timestampMillisecondsUtc: Double ->
      require(latitudeDegreesNorth in -90.0..90.0) { "Latitude must be within -90..90 degrees." }
      require(longitudeDegreesEast in -180.0..180.0) { "Longitude must be within -180..180 degrees." }
      require(elevationMetersAboveMeanSeaLevel.isFinite()) { "Elevation must be finite." }
      require(timestampMillisecondsUtc.isFinite()) { "Timestamp must be finite." }
      val field = GeomagneticField(
        latitudeDegreesNorth.toFloat(),
        longitudeDegreesEast.toFloat(),
        elevationMetersAboveMeanSeaLevel.toFloat(),
        timestampMillisecondsUtc.toLong()
      )
      declinationRadians = Math.toRadians(field.declination.toDouble())
    }

    AsyncFunction<Bundle>("getRearCameraFieldOfViewAsync") {
      rearCameraFieldOfView()
    }

    OnStartObserving {
      startObserving()
    }
    OnStopObserving {
      stopObserving()
    }
    OnActivityEntersForeground {
      if (isObserving) registerSensor()
    }
    OnActivityEntersBackground {
      if (isObserving) sensorManager.unregisterListener(this@AstrovisibilityDevicePoseModule)
    }
    OnDestroy {
      stopObserving()
    }
  }

  private fun startObserving() {
    isObserving = true
    registerSensor()
  }

  private fun stopObserving() {
    sensorManager.unregisterListener(this)
    isObserving = false
  }

  private fun registerSensor() {
    sensorManager.unregisterListener(this)
    rotationVectorSensor?.let { sensor ->
      sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)
    }
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
    SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)

    // The Android matrix columns are device +X, +Y and +Z expressed in the
    // magnetic east/north/up world frame. The rear camera looks along device -Z.
    val right = trueNorthVector(
      rotationMatrix[0].toDouble(),
      rotationMatrix[3].toDouble(),
      rotationMatrix[6].toDouble()
    )
    val up = trueNorthVector(
      rotationMatrix[1].toDouble(),
      rotationMatrix[4].toDouble(),
      rotationMatrix[7].toDouble()
    )
    val forward = trueNorthVector(
      -rotationMatrix[2].toDouble(),
      -rotationMatrix[5].toDouble(),
      -rotationMatrix[8].toDouble()
    )
    sendEvent(
      "onPoseChanged",
      Bundle().apply {
        putInt("accuracy", sensorAccuracy)
        putBundle("forward", forward)
        putBundle("right", right)
        putDouble("timestampNanoseconds", event.timestamp.toDouble())
        putBundle("up", up)
      }
    )
  }

  private fun trueNorthVector(magneticEast: Double, magneticNorth: Double, worldUp: Double): Bundle {
    val cosine = cos(declinationRadians)
    val sine = sin(declinationRadians)
    return Bundle().apply {
      putDouble("east", cosine * magneticEast + sine * magneticNorth)
      putDouble("north", -sine * magneticEast + cosine * magneticNorth)
      putDouble("up", worldUp)
    }
  }

  override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {
    if (sensor.type == Sensor.TYPE_ROTATION_VECTOR) sensorAccuracy = accuracy
  }

  override fun onFlushCompleted(sensor: Sensor) = Unit

  private fun rearCameraFieldOfView(): Bundle {
    val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    val characteristics = cameraManager.cameraIdList
      .map { cameraManager.getCameraCharacteristics(it) }
      .firstOrNull {
        it.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
      }
    val physicalSize = characteristics?.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
    val focalLengths = characteristics
      ?.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
      ?.filter { it.isFinite() && it > 0f }

    if (physicalSize == null || focalLengths.isNullOrEmpty()) return fallbackFieldOfView()
    // A logical rear camera may expose ultrawide, standard and telephoto focal
    // lengths. Expo Camera opens the normal 1x rear view, so select the lens
    // closest to a standard 70-degree landscape horizontal FOV rather than the
    // shortest (ultrawide) focal length.
    val focalLength = focalLengths.minBy { candidate ->
      val horizontal = 2.0 * atan(physicalSize.width / (2.0 * candidate)) * 180.0 / PI
      abs(horizontal - 70.0)
    }
    val landscapeHorizontal = 2.0 * atan(physicalSize.width / (2.0 * focalLength)) * 180.0 / PI
    val landscapeVertical = 2.0 * atan(physicalSize.height / (2.0 * focalLength)) * 180.0 / PI
    // The app and camera preview are portrait locked, so the sensor axes swap.
    val portraitHorizontal = landscapeVertical
    val portraitVertical = landscapeHorizontal
    if (portraitHorizontal !in 10.0..140.0 || portraitVertical !in 10.0..140.0) {
      return fallbackFieldOfView()
    }
    return Bundle().apply {
      putBoolean("approximate", false)
      putDouble("horizontalDegrees", portraitHorizontal)
      putDouble("verticalDegrees", portraitVertical)
    }
  }

  private fun fallbackFieldOfView() = Bundle().apply {
    putBoolean("approximate", true)
    putDouble("horizontalDegrees", FALLBACK_HORIZONTAL_FOV_DEGREES)
    putDouble("verticalDegrees", FALLBACK_VERTICAL_FOV_DEGREES)
  }
}
