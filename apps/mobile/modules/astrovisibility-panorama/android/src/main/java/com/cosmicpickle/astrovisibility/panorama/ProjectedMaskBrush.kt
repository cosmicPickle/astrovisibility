package com.cosmicpickle.astrovisibility.panorama

import org.opencv.core.Point
import kotlin.math.*

/** Native worker rasterization at original atlas texel centres. Screen-space
 * segment bins avoid testing every stroke segment against every atlas pixel. */
internal fun selectProjectedMaskBrush(
  width: Int, height: Int, view: DoubleArray, points: List<Point>, radius: Double,
  checkCancelled: () -> Unit
): ByteArray {
  require(width in 1..2048 && height in 1..2048)
  // View: canvas width/height, projection scale, then right/up/forward xyz.
  require(view.size == 12 && view.all { it.isFinite() })
  require(view[0] in 1.0..4096.0 && view[1] in 1.0..4096.0 && view[2] > 0)
  require(radius in 0.5..72.0 && points.size in 1..4096)
  require(points.all { it.x.isFinite() && it.y.isFinite() && abs(it.x) <= 10000 && abs(it.y) <= 10000 })
  val columns = ceil(view[0] / 64).toInt()
  val rows = ceil(view[1] / 64).toInt()
  val bins = Array(columns * rows) { ArrayList<Int>() }
  val atlasRadius = min(width, height) / 2.0
  var atlasLeft = width
  var atlasRight = 0
  var atlasTop = height
  var atlasBottom = 0
  var references = 0
  for (index in points.indices) {
    checkCancelled()
    val start = points[maxOf(0, index - 1)]
    val end = points[index]
    val segmentLength = hypot(end.x - start.x, end.y - start.y)
    val partitions = max(1, ceil(segmentLength / radius).toInt())
    // Subdivide only the conservative search bound; the exact painted segment
    // remains unchanged, including strokes with sparse native pointer events.
    for (partition in 0 until partitions) {
      val fraction = (partition + 0.5) / partitions
      val midpointX = start.x + (end.x - start.x) * fraction
      val midpointY = start.y + (end.y - start.y) * fraction
      val localX = (midpointX - view[0] / 2) / view[2]
      val localY = (view[1] / 2 - midpointY) / view[2]
      val squared = localX * localX + localY * localY
      val east = (2 * localX * view[3] + 2 * localY * view[6] + (1 - squared) * view[9]) / (1 + squared)
      val up = (2 * localX * view[4] + 2 * localY * view[7] + (1 - squared) * view[10]) / (1 + squared)
      val north = (2 * localX * view[5] + 2 * localY * view[8] + (1 - squared) * view[11]) / (1 + squared)
      if (up < 0) {
        // The upper-hemisphere bound below does not apply to a lower-sky centre.
        atlasLeft = 0; atlasRight = width - 1; atlasTop = 0; atlasBottom = height - 1
      } else {
        val radial = hypot(east, north)
        val atlasScale = if (radial > 1e-12) acos(up.coerceIn(0.0, 1.0)) / (PI / 2) / radial else 2 / PI
        val centerX = width / 2.0 + atlasRadius * east * atlasScale
        val centerY = height / 2.0 - atlasRadius * north * atlasScale
        // Inverse stereographic angular speed <= 2 / projectionScale. The
        // upper-hemisphere azimuthal map stretches geodesic distance by <= atlasRadius.
        // This conservative bound includes the entire segment capsule, not just samples.
        val extent = atlasRadius * 2 / view[2] * (segmentLength / (2 * partitions) + radius) + 1
        atlasLeft = min(atlasLeft, floor(centerX - extent).toInt().coerceIn(0, width - 1))
        atlasRight = max(atlasRight, ceil(centerX + extent).toInt().coerceIn(0, width - 1))
        atlasTop = min(atlasTop, floor(centerY - extent).toInt().coerceIn(0, height - 1))
        atlasBottom = max(atlasBottom, ceil(centerY + extent).toInt().coerceIn(0, height - 1))
      }
    }
    val left = floor((min(start.x, end.x) - radius) / 64).toInt().coerceIn(0, columns - 1)
    val right = floor((max(start.x, end.x) + radius) / 64).toInt().coerceIn(0, columns - 1)
    val top = floor((min(start.y, end.y) - radius) / 64).toInt().coerceIn(0, rows - 1)
    val bottom = floor((max(start.y, end.y) + radius) / 64).toInt().coerceIn(0, rows - 1)
    for (row in top..bottom) for (column in left..right) {
      require(++references <= 2_000_000)
      bins[row * columns + column].add(index)
    }
  }
  val selected = ByteArray((width * height + 7) / 8)
  for (y in atlasTop..atlasBottom) {
    checkCancelled()
    val atlasY = (y + 0.5 - height / 2.0) / atlasRadius
    for (x in atlasLeft..atlasRight) {
      val atlasX = (x + 0.5 - width / 2.0) / atlasRadius
      val radial = hypot(atlasX, atlasY)
      if (radial > 1) continue
      val zenithAngle = radial * PI / 2
      val scale = if (radial > 1e-12) sin(zenithAngle) / radial else PI / 2
      val east = atlasX * scale
      val up = cos(zenithAngle)
      val north = -atlasY * scale
      val denominator = 1 + east * view[9] + up * view[10] + north * view[11]
      if (denominator <= 1e-10) continue
      val screenX = view[0] / 2 + view[2] * (east * view[3] + up * view[4] + north * view[5]) / denominator
      val screenY = view[1] / 2 - view[2] * (east * view[6] + up * view[7] + north * view[8]) / denominator
      if (screenX < 0 || screenX >= view[0] || screenY < 0 || screenY >= view[1]) continue
      for (index in bins[(screenY / 64).toInt() * columns + (screenX / 64).toInt()]) {
        val start = points[maxOf(0, index - 1)]
        val end = points[index]
        val dx = end.x - start.x
        val dy = end.y - start.y
        val lengthSquared = dx * dx + dy * dy
        val t = if (lengthSquared > 0) ((screenX - start.x) * dx + (screenY - start.y) * dy).div(lengthSquared).coerceIn(0.0, 1.0) else 0.0
        val distanceX = screenX - start.x - t * dx
        val distanceY = screenY - start.y - t * dy
        if (distanceX * distanceX + distanceY * distanceY <= radius * radius) {
          val pixel = y * width + x
          selected[pixel / 8] = (selected[pixel / 8].toInt() or (1 shl (pixel % 8))).toByte()
          break
        }
      }
    }
  }
  return selected
}
