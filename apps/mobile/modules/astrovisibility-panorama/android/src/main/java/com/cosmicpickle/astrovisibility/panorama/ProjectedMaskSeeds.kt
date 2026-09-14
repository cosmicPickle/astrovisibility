package com.cosmicpickle.astrovisibility.panorama

import org.opencv.core.Point
import kotlin.math.*

internal fun validateMaskBrush(width: Int, height: Int, view: DoubleArray, points: List<Point>, radius: Double) {
  require(width in 1..2048 && height in 1..2048)
  // View: canvas width/height, projection scale, then right/up/forward xyz.
  require(view.size == 12 && view.all { it.isFinite() })
  require(view[0] in 1.0..4096.0 && view[1] in 1.0..4096.0 && view[2] > 0)
  require(radius in 0.5..72.0 && points.size in 1..4096)
  require(points.all { it.x.isFinite() && it.y.isFinite() && abs(it.x) <= 10000 && abs(it.y) <= 10000 })
}

/** Inverse stereographic camera -> upper-hemisphere azimuthal atlas. */
internal fun projectMaskAtlasPoint(width: Int, height: Int, view: DoubleArray, x: Double, y: Double): Point? {
  val localX = (x - view[0] / 2) / view[2]
  val localY = (view[1] / 2 - y) / view[2]
  val squared = localX * localX + localY * localY
  val east = (2 * localX * view[3] + 2 * localY * view[6] + (1 - squared) * view[9]) / (1 + squared)
  val up = (2 * localX * view[4] + 2 * localY * view[7] + (1 - squared) * view[10]) / (1 + squared)
  val north = (2 * localX * view[5] + 2 * localY * view[8] + (1 - squared) * view[11]) / (1 + squared)
  if (up < 0) return null
  val radial = hypot(east, north)
  val atlasScale = if (radial > 1e-12) acos(up.coerceIn(0.0, 1.0)) / (PI / 2) / radial else 2 / PI
  val atlasRadius = min(width, height) / 2.0
  return Point(width / 2.0 + atlasRadius * east * atlasScale,
    height / 2.0 - atlasRadius * north * atlasScale)
}

/** Seed the centre path, never every colour under a large brush disc. */
internal fun selectProjectedMaskSeeds(
  width: Int, height: Int, view: DoubleArray, points: List<Point>, radius: Double,
  checkCancelled: () -> Unit
): List<Point> {
  validateMaskBrush(width, height, view, points, radius)
  // Same conservative angular/atlas stretch bound as manual rasterization:
  // consecutive samples travel at most one source texel in the upper hemisphere.
  val spacing = min(radius, view[2] / min(width, height))
  val seeds = LinkedHashSet<Int>()
  var samples = 0
  for (index in points.indices) {
    val start = points[max(0, index - 1)]
    val end = points[index]
    val count = max(1, ceil(hypot(end.x - start.x, end.y - start.y) / spacing).toInt())
    require(count <= 65536 - samples) { "Use a shorter stroke" }
    samples += count
    for (step in 1..count) {
      checkCancelled()
      val x = start.x + (end.x - start.x) * step / count
      val y = start.y + (end.y - start.y) * step / count
      if (x < 0 || y < 0 || x >= view[0] || y >= view[1]) continue
      val atlas = projectMaskAtlasPoint(width, height, view, x, y) ?: continue
      val column = floor(atlas.x).toInt(); val row = floor(atlas.y).toInt()
      if (column !in 0 until width || row !in 0 until height) continue
      seeds.add(row * width + column)
      require(seeds.size <= 4096) { "Use a shorter stroke" }
    }
  }
  return seeds.map { Point((it % width).toDouble(), (it / width).toDouble()) }
}
