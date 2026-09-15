package com.cosmicpickle.astrovisibility.panorama

import android.graphics.Bitmap
import org.opencv.core.Point
import kotlin.math.*

/** Rectilinear model view; all bases use east/up/north, matching the mask atlas. */
internal class MaskPerspective(val view: DoubleArray, center: Point, val fieldOfViewDegrees: Double) {
  val size = 768
  private val extent = tan(Math.toRadians(fieldOfViewDegrees) / 2)
  private val forward = screenDirection(center)
  private val right: DoubleArray
  private val up: DoubleArray

  init {
    require(fieldOfViewDegrees in 30.0..140.0)
    val viewUp = view.copyOfRange(6, 9)
    right = normalized(cross(viewUp, forward))
    up = cross(forward, right)
  }

  private fun screenDirection(point: Point): DoubleArray {
    val x = (point.x - view[0] / 2) / view[2]
    val y = (view[1] / 2 - point.y) / view[2]
    val squared = x * x + y * y
    return DoubleArray(3) { axis ->
      (2 * x * view[3 + axis] + 2 * y * view[6 + axis] + (1 - squared) * view[9 + axis]) / (1 + squared)
    }
  }

  fun screenToPatch(point: Point): Point? {
    val direction = screenDirection(point)
    return directionToPatch(direction[0], direction[1], direction[2])
  }

  fun atlasToPatch(width: Int, height: Int, x: Double, y: Double): Point? {
    val east = (x - width / 2.0) / (min(width, height) / 2.0)
    val north = (height / 2.0 - y) / (min(width, height) / 2.0)
    val radius = hypot(east, north)
    if (radius > 1) return null
    val factor = if (radius > 1e-12) sin(radius * PI / 2) / radius else PI / 2
    return directionToPatch(east * factor, cos(radius * PI / 2), north * factor)
  }

  private fun directionToPatch(east: Double, altitude: Double, north: Double): Point? {
    val depth = east * forward[0] + altitude * forward[1] + north * forward[2]
    if (depth <= 1e-9) return null
    val x = (east * right[0] + altitude * right[1] + north * right[2]) / (depth * extent)
    val y = (east * up[0] + altitude * up[1] + north * up[2]) / (depth * extent)
    if (abs(x) > 1 || abs(y) > 1) return null
    return Point((x + 1) * size / 2, (1 - y) * size / 2)
  }

  fun render(source: IntArray, width: Int, height: Int, checkCancelled: () -> Unit): Bitmap {
    val pixels = IntArray(size * size)
    val radius = min(width, height) / 2.0
    for (y in 0 until size) {
      checkCancelled()
      for (x in 0 until size) {
        val horizontal = ((x + 0.5) * 2 / size - 1) * extent
        val vertical = (1 - (y + 0.5) * 2 / size) * extent
        val east = forward[0] + right[0] * horizontal + up[0] * vertical
        val altitude = forward[1] + right[1] * horizontal + up[1] * vertical
        val north = forward[2] + right[2] * horizontal + up[2] * vertical
        if (altitude < 0) continue
        val horizontalLength = hypot(east, north)
        val angle = atan2(horizontalLength, altitude)
        val scale = if (horizontalLength > 1e-12) radius * angle / (PI / 2) / horizontalLength else 0.0
        val column = floor(width / 2.0 + east * scale).toInt()
        val row = floor(height / 2.0 - north * scale).toInt()
        if (column in 0 until width && row in 0 until height) pixels[y * size + x] = source[row * width + column]
      }
    }
    return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
  }

  /** Cached lookup avoids repeating spherical transforms for every stroke. */
  fun atlasLookup(source: IntArray, width: Int, height: Int, checkCancelled: () -> Unit): IntArray {
    val lookup = IntArray(width * height) { -1 }
    for (y in 0 until height) {
      checkCancelled()
      for (x in 0 until width) {
        val index = y * width + x
        if (source[index] ushr 24 == 0) continue
        val patch = atlasToPatch(width, height, x + 0.5, y + 0.5) ?: continue
        val column = patch.x.toInt(); val row = patch.y.toInt()
        if (column in 0 until size && row in 0 until size) lookup[index] = row * size + column
      }
    }
    return lookup
  }

  private fun cross(a: DoubleArray, b: DoubleArray) = doubleArrayOf(
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])

  private fun normalized(vector: DoubleArray): DoubleArray {
    val length = sqrt(vector.sumOf { it * it })
    require(length > 1e-9)
    return DoubleArray(3) { vector[it] / length }
  }
}
