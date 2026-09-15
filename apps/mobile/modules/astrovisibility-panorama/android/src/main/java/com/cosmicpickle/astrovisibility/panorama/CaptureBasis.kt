package com.cosmicpickle.astrovisibility.panorama

import org.opencv.core.CvType
import org.opencv.core.Mat
import kotlin.math.*

/** Row-major camera-to-world rotation. World east/north/up; camera right/down/forward. */
internal object CaptureBasis {
  fun multiply(a: DoubleArray, b: DoubleArray) = DoubleArray(9) { index ->
    val row = index / 3; val column = index % 3
    (0..2).sumOf { a[row * 3 + it] * b[it * 3 + column] }
  }
  fun transpose(a: DoubleArray) = DoubleArray(9) { a[(it % 3) * 3 + it / 3] }
  fun fromPlacement(azimuth: Double, altitude: Double, roll: Double): DoubleArray {
    val az = Math.toRadians(azimuth); val alt = Math.toRadians(altitude)
    val angle = Math.toRadians(roll)
    val forward = doubleArrayOf(sin(az) * cos(alt), cos(az) * cos(alt), sin(alt))
    val right = doubleArrayOf(cos(az), -sin(az), 0.0)
    val up = doubleArrayOf(-sin(az) * sin(alt), -cos(az) * sin(alt), cos(alt))
    return DoubleArray(9) { index ->
      val axis = index / 3
      when (index % 3) {
        0 -> cos(angle) * right[axis] + sin(angle) * up[axis]
        1 -> sin(angle) * right[axis] - cos(angle) * up[axis]
        else -> forward[axis]
      }
    }
  }
  fun placement(b: DoubleArray): DoubleArray {
    val az = atan2(b[2], b[5])
    val alt = asin(b[8].coerceIn(-1.0, 1.0))
    val unrolled = fromPlacement(Math.toDegrees(az), Math.toDegrees(alt), 0.0)
    val sine = (0..2).sumOf { b[it * 3 + 1] * unrolled[it * 3] }
    val cosine = (0..2).sumOf { b[it * 3 + 1] * unrolled[it * 3 + 1] }
    return doubleArrayOf((Math.toDegrees(az) + 360) % 360, Math.toDegrees(alt), Math.toDegrees(atan2(sine, cosine)))
  }
  fun angleDegrees(a: DoubleArray, b: DoubleArray): Double {
    val trace = a.indices.sumOf { a[it] * b[it] }
    return Math.toDegrees(acos(((trace - 1) / 2).coerceIn(-1.0, 1.0)))
  }
  fun centerAngleDegrees(a: DoubleArray, b: DoubleArray) = Math.toDegrees(
    acos((a[2] * b[2] + a[5] * b[5] + a[8] * b[8]).coerceIn(-1.0, 1.0)))
  fun intrinsic(width: Int, height: Int, horizontalFov: Double, verticalFov: Double) = doubleArrayOf(
    width / (2 * tan(Math.toRadians(horizontalFov) / 2)), 0.0, width / 2.0,
    0.0, height / (2 * tan(Math.toRadians(verticalFov) / 2)), height / 2.0,
    0.0, 0.0, 1.0)
  fun matrix(values: DoubleArray) = Mat(3, 3, CvType.CV_64F).also { it.put(0, 0, *values) }
  fun imageHomography(source: DoubleArray, target: DoubleArray, width: Int, height: Int,
    horizontalFov: Double, verticalFov: Double): Mat {
    val intrinsics = intrinsic(width, height, horizontalFov, verticalFov)
    val inverse = doubleArrayOf(1 / intrinsics[0], 0.0, -intrinsics[2] / intrinsics[0],
      0.0, 1 / intrinsics[4], -intrinsics[5] / intrinsics[4], 0.0, 0.0, 1.0)
    return matrix(multiply(multiply(intrinsics, multiply(transpose(target), source)), inverse))
  }
  fun pose(b: DoubleArray, timestamp: Long, accuracy: Int = 3): Map<String, Any> {
    fun vector(column: Int, sign: Double) = mapOf("east" to sign * b[column],
      "north" to sign * b[3 + column], "up" to sign * b[6 + column])
    return mapOf("accuracy" to accuracy, "timestampNanoseconds" to timestamp.toDouble(),
      "right" to vector(0, 1.0), "up" to vector(1, -1.0), "forward" to vector(2, 1.0))
  }
}
