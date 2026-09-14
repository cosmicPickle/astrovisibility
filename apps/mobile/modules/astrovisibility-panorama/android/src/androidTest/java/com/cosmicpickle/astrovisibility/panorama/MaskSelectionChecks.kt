package com.cosmicpickle.astrovisibility.panorama

import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Point

/** Synthetic pixels only; checks the exact OpenCV path used by the editor. */
internal fun checkMaskSelection() {
  System.loadLibrary("opencv_java4")
  val width = 32
  val height = 24
  val pixels = ByteArray(width * height * 4)
  for (y in 0 until height) for (x in 0 until width) {
    val offset = (y * width + x) * 4
    val barrier = x == 15
    pixels[offset] = (if (barrier) 30 else 120).toByte()
    pixels[offset + 1] = (if (barrier) 30 else 180).toByte()
    pixels[offset + 2] = (if (barrier) 30 else 220).toByte()
    pixels[offset + 3] = (if (y == 12) 0 else 255).toByte()
  }
  val rgba = Mat(height, width, CvType.CV_8UC4)
  rgba.put(0, 0, pixels)
  try {
    ConnectedMaskSelection(rgba).use { selection ->
      fun selected(bytes: ByteArray, x: Int, y: Int) =
        (bytes[(y * width + x) / 8].toInt() and (1 shl ((y * width + x) % 8))) != 0
      val left = selection.select(listOf(Point(2.0, 2.0))) {}
      check(selected(left, 14, 11)) { "Connected similar pixels were missed" }
      check(!selected(left, 15, 2)) { "Selection crossed a contrasting edge" }
      check(!selected(left, 20, 2)) { "Disconnected matching colour was selected" }
      check(!selected(left, 2, 13)) { "Selection crossed transparent coverage" }
      check(!selected(left, 2, 12)) { "Transparent pixel was selected" }
      val both = selection.select(listOf(Point(2.0, 2.0), Point(20.0, 2.0))) {}
      check(selected(both, 20, 2)) { "Second seed was ignored" }
      // A new stroke must not inherit the previous stroke's flood-fill mask.
      val right = selection.select(listOf(Point(20.0, 2.0))) {}
      check(!selected(right, 2, 2))
      val empty = selection.select(listOf(Point(2.0, 12.0))) {}
      check(empty.all { it == 0.toByte() })
      var cancelled = false
      try { selection.select(listOf(Point(2.0, 2.0))) { throw InterruptedException() } }
      catch (_: InterruptedException) { cancelled = true }
      check(cancelled) { "Selection ignored cancellation" }
      var rejected = false
      try { selection.select(listOf(Point(Double.NaN, 2.0))) {} }
      catch (_: IllegalArgumentException) { rejected = true }
      check(rejected) { "Invalid seed was accepted" }
    }
  } finally {
    rgba.release()
  }
  checkProjectedBrush()
  checkRotatedBrushCaps()
  benchmarkMaskBrush()
  checkNightMaskSelection()
}

private fun checkRotatedBrushCaps() {
  for (azimuth in listOf(0.0, 359.9, 90.0, 180.0)) for (altitude in listOf(0.0, 45.0, 90.0)) {
    val az = Math.toRadians(azimuth); val alt = Math.toRadians(altitude)
    val right = doubleArrayOf(kotlin.math.cos(az), 0.0, -kotlin.math.sin(az))
    val up = doubleArrayOf(-kotlin.math.sin(az) * kotlin.math.sin(alt), kotlin.math.cos(alt), -kotlin.math.cos(az) * kotlin.math.sin(alt))
    val forward = doubleArrayOf(kotlin.math.sin(az) * kotlin.math.cos(alt), kotlin.math.sin(alt), kotlin.math.cos(az) * kotlin.math.cos(alt))
    for (scale in listOf(150.0, 1500.0)) {
      val view = doubleArrayOf(400.0, 600.0, scale) + right + up + forward
      val result = selectProjectedMaskBrush(96, 96, view, listOf(Point(300.0, 300.0)), 16.0) {}
      // Independently test the plane of the spherical cap corresponding to the
      // off-centre screen circle, including north wrap, zenith and horizon clipping.
      val offset = 100.0 / scale
      val constant = offset * offset - (16.0 / scale) * (16.0 / scale)
      for (y in 0 until 96) for (x in 0 until 96) {
        val px = (x + 0.5 - 48) / 48; val py = (y + 0.5 - 48) / 48
        val radial = kotlin.math.hypot(px, py)
        var expected = false
        if (radial <= 1) {
          val factor = kotlin.math.sin(radial * Math.PI / 2) / radial
          val direction = doubleArrayOf(px * factor, kotlin.math.cos(radial * Math.PI / 2), -py * factor)
          val horizontal = direction.indices.sumOf { direction[it] * right[it] }
          val depth = direction.indices.sumOf { direction[it] * forward[it] }
          expected = 2 * offset * horizontal + (1 - constant) * depth >= 1 + constant
        }
        val pixel = y * 96 + x
        val actual = result[pixel / 8].toInt() and (1 shl (pixel % 8)) != 0
        check(actual == expected) { "Rotated brush cap disagrees with spherical geometry" }
      }
    }
  }
}

private fun benchmarkMaskBrush() {
  val view = doubleArrayOf(400.0, 600.0, 200.0, 1.0, 0.0, 0.0,
    0.0, 0.0, -1.0, 0.0, 1.0, 0.0)
  val start = System.nanoTime()
  val footprint = selectProjectedMaskBrush(2048, 2048, view,
    listOf(Point(160.0, 300.0), Point(240.0, 320.0)), 16.0) {}
  val manualMilliseconds = (System.nanoTime() - start) / 1_000_000
  val rgba = Mat(2048, 2048, CvType.CV_8UC4, org.opencv.core.Scalar(90.0, 150.0, 210.0, 255.0))
  try {
    ConnectedMaskSelection(rgba).use { selection ->
      val selectionStart = System.nanoTime()
      val result = selection.select(selectProjectedMaskSeeds(2048, 2048, view,
        listOf(Point(160.0, 300.0), Point(240.0, 320.0)), 16.0) {}) {}
      check(result.all { it == 255.toByte() })
      android.util.Log.i("MaskEditorChecks", "Synthetic 2048px manual=${manualMilliseconds}ms connected=${(System.nanoTime() - selectionStart) / 1_000_000}ms")
    }
  } finally { rgba.release() }
}

private fun checkProjectedBrush() {
  val view = doubleArrayOf(400.0, 600.0, 200.0, 1.0, 0.0, 0.0,
    0.0, 0.0, -1.0, 0.0, 1.0, 0.0)
  val bytes = selectProjectedMaskBrush(256, 256, view, listOf(Point(200.0, 300.0)), 20.0) {}
  // A centred stereographic circle is a spherical cap. Its exact radial extent
  // in the persisted azimuthal atlas is 2 atan(screenRadius / scale) / (pi/2).
  val radius = 128 * 2 * kotlin.math.atan(20.0 / 200) / (Math.PI / 2)
  for (y in 0 until 256) for (x in 0 until 256) {
    val actual = bytes[(y * 256 + x) / 8].toInt() and (1 shl (x % 8)) != 0
    val expected = kotlin.math.hypot(x + 0.5 - 128, y + 0.5 - 128) <= radius
    check(actual == expected) { "Zenith brush disagrees with spherical cap" }
  }
  val zoomed = view.copyOf().apply { this[2] *= 2 }
  val fine = selectProjectedMaskBrush(256, 256, zoomed, listOf(Point(200.0, 300.0)), 20.0) {}
  check(fine.sumOf { Integer.bitCount(it.toInt() and 255) } < bytes.sumOf { Integer.bitCount(it.toInt() and 255) })
  val line = selectProjectedMaskBrush(256, 256, view,
    listOf(Point(140.0, 300.0), Point(260.0, 300.0)), 20.0) {}
  check(line.sumOf { Integer.bitCount(it.toInt() and 255) } > bytes.sumOf { Integer.bitCount(it.toInt() and 255) })
}
