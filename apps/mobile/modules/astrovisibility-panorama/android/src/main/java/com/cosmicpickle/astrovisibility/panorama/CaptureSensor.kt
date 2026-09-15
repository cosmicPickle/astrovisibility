package com.cosmicpickle.astrovisibility.panorama

import android.content.Context
import android.hardware.*
import kotlin.math.*

internal class CaptureSensor(context: Context) : SensorEventListener {
  private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private val samples = ArrayDeque<Pair<Long, DoubleArray>>()
  @Volatile var declinationRadians = 0.0
  @Volatile private var accuracy = SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM
  val currentAccuracy get() = accuracy
  fun start() = manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)?.let {
    manager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
  } ?: false
  fun stop() { manager.unregisterListener(this); synchronized(samples) { samples.clear() } }
  override fun onAccuracyChanged(sensor: Sensor, value: Int) { accuracy = value }
  override fun onSensorChanged(event: SensorEvent) {
    if (accuracy < SensorManager.SENSOR_STATUS_ACCURACY_LOW) return
    val rotation = FloatArray(9)
    SensorManager.getRotationMatrixFromVector(rotation, event.values)
    val camera = DoubleArray(9) { rotation[it].toDouble() * if (it % 3 == 0) 1 else -1 }
    val cosine = cos(declinationRadians); val sine = sin(declinationRadians)
    val north = doubleArrayOf(cosine, sine, 0.0, -sine, cosine, 0.0, 0.0, 0.0, 1.0)
    synchronized(samples) {
      samples.addLast(event.timestamp to CaptureBasis.multiply(north, camera))
      while (samples.size > 120) samples.removeFirst()
    }
  }
  fun at(timestamp: Long): DoubleArray? = synchronized(samples) {
    samples.minByOrNull { abs(it.first - timestamp) }
      ?.takeIf { abs(it.first - timestamp) < 120_000_000 }?.second
  }
}
