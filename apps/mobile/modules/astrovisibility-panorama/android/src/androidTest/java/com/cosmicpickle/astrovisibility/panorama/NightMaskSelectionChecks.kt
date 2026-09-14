package com.cosmicpickle.astrovisibility.panorama

import android.util.Log
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Point

/** Synthetic night colours, shading and reproducible sensor noise; no user image. */
internal fun checkNightMaskSelection() {
  for (noise in listOf(3, 5, 7)) checkNoisyNightRegion(noise)
  checkMagicCentreSeeds()
  checkNarrowMaskFeatures()
  benchmarkNightSelection()
}

private fun checkNoisyNightRegion(noiseAmplitude: Int) {
  val width = 256
  val height = 192
  val pixels = ByteArray(width * height * 4)
  val random = java.util.Random(20260914L + noiseAmplitude)
  // Leave sky above the trunk so the expected sky is one connected region.
  fun tree(x: Int, y: Int) = (y >= 20 && x in 94..116) || (y > 95 && x in 64..150)
  for (y in 0 until height) for (x in 0 until width) {
    val base = if (tree(x, y)) intArrayOf(8, 11, 14) else intArrayOf(18, 22, 30)
    for (channel in 0..2) {
      val noise = random.nextInt(2 * noiseAmplitude + 1) - noiseAmplitude
      pixels[(y * width + x) * 4 + channel] = (base[channel] + y / 48 + noise).toByte()
    }
    pixels[(y * width + x) * 4 + 3] = 255.toByte()
  }
  val rgba = Mat(height, width, CvType.CV_8UC4)
  rgba.put(0, 0, pixels)
  fun selected(bits: ByteArray, pixel: Int) = bits[pixel / 8].toInt() and (1 shl (pixel % 8)) != 0
  try {
    ConnectedMaskSelection(rgba).use { selector ->
      val sky = selector.select(listOf(Point(35.0, 40.0))) {}
      val nearby = selector.select(listOf(Point(37.0, 41.0))) {}
      val trunk = selector.select(listOf(Point(105.0, 40.0))) {}
      var skyTotal = 0; var skyHit = 0; var treeTotal = 0; var treeHit = 0
      var leakedSky = 0; var leakedTree = 0; var union = 0; var intersection = 0
      for (y in 3 until height - 3) for (x in 3 until width - 3) {
        if ((-2..2).any { dx -> (-2..2).any { dy -> tree(x + dx, y + dy) != tree(x, y) } }) continue
        val pixel = y * width + x
        val inSky = selected(sky, pixel); val inTree = selected(trunk, pixel)
        val inNearby = selected(nearby, pixel)
        if (tree(x, y)) {
          treeTotal++; if (inTree) treeHit++; if (inSky) leakedTree++
        } else {
          skyTotal++; if (inSky) skyHit++; if (inTree) leakedSky++
        }
        if (inSky || inNearby) union++
        if (inSky && inNearby) intersection++
      }
      Log.i("MaskEditorChecks", "Night noise=$noiseAmplitude sky=$skyHit/$skyTotal tree=$treeHit/$treeTotal skyLeak=$leakedSky treeLeak=$leakedTree overlap=$intersection/$union")
      check(leakedSky.toDouble() / skyTotal < 0.002) { "Dark tree leaked into sky" }
      check(leakedTree.toDouble() / treeTotal < 0.002) { "Sky leaked into the dark tree" }
      check(skyHit.toDouble() / skyTotal > 0.98) { "Noisy sky has holes or incomplete growth" }
      check(treeHit.toDouble() / treeTotal > 0.98) { "Noisy tree has holes or incomplete growth" }
      check(intersection.toDouble() / union > 0.95) { "Nearby taps select inconsistent regions" }
    }
  } finally { rgba.release() }
}

private fun benchmarkNightSelection() {
  val width = 2048
  val pixels = ByteArray(width * width * 4)
  val random = java.util.Random(20260914L)
  var expectedSky = 0
  for (y in 0 until width) for (x in 0 until width) {
    val tree = (x in 980..1068 && y in 256 until 1500) || (x in 850 until 1200 && y in 300 until 450)
    if (!tree) expectedSky++
    val base = if (tree) intArrayOf(8, 11, 14) else intArrayOf(18, 22, 30)
    for (channel in 0..2) pixels[(y * width + x) * 4 + channel] =
      (base[channel] + y / 512 + random.nextInt(11) - 5).toByte()
    pixels[(y * width + x) * 4 + 3] = 255.toByte()
  }
  val rgba = Mat(width, width, CvType.CV_8UC4)
  rgba.put(0, 0, pixels)
  try {
    val preparationStart = System.nanoTime()
    ConnectedMaskSelection(rgba).use { selector ->
      val preparationMs = (System.nanoTime() - preparationStart) / 1_000_000
      val selectionStart = System.nanoTime()
      val result = selector.select(listOf(Point(350.0, 400.0))) {}
      val selectionMs = (System.nanoTime() - selectionStart) / 1_000_000
      val count = result.sumOf { Integer.bitCount(it.toInt() and 255) }
      var interior = 0; var holes = 0
      for (y in 3 until width - 3) for (x in 3 until width - 3) {
        if (x in 800..1240) continue
        interior++
        val pixel = y * width + x
        if (result[pixel / 8].toInt() and (1 shl (pixel % 8)) == 0) holes++
      }
      Log.i("MaskEditorChecks", "Night 2048px pinholes=$holes/$interior")
      check(holes.toDouble() / interior < 0.000005) { "Large sky selection leaves visible noise pinholes" }
      check(count > expectedSky * 0.98 && count <= expectedSky + 100) { "Large noisy selection is incomplete or crossed the trunk" }
      Log.i("MaskEditorChecks", "Night 2048px prepare=${preparationMs}ms selection=${selectionMs}ms selected=$count")
      for (seed in listOf(Point(350.0, 100.0), Point(350.0, 1400.0), Point(1500.0, 800.0))) {
        val selection = selector.select(listOf(seed)) {}
        var leaked = 0
        for (y in 260 until 1496) for (x in 984..1064) {
          val pixel = y * width + x
          if (selection[pixel / 8].toInt() and (1 shl (pixel % 8)) != 0) leaked++
        }
        Log.i("MaskEditorChecks", "Night long boundary seed=${seed.x},${seed.y} leaked=$leaked")
        check(leaked < 100) { "Sky crossed a long, faint tree boundary" }
      }
    }
  } finally { rgba.release() }
}

private fun checkMagicCentreSeeds() {
  val view = doubleArrayOf(400.0, 600.0, 200.0, 1.0, 0.0, 0.0,
    0.0, 0.0, -1.0, 0.0, 1.0, 0.0)
  val tap = selectProjectedMaskSeeds(256, 256, view, listOf(Point(200.0, 300.0)), 36.0) {}
  check(tap.size == 1 && tap.single() == Point(128.0, 128.0)) { "Magic tap did not use its centre" }
  val line = selectProjectedMaskSeeds(256, 256, view,
    listOf(Point(100.0, 300.0), Point(300.0, 300.0)), 36.0) {}
  check(line.zipWithNext().all { (a, b) -> kotlin.math.abs(a.x - b.x) <= 1 && kotlin.math.abs(a.y - b.y) <= 1 })
  check(line.any { it.x == 128.0 }) { "Sparse pointer events skipped the narrow centre feature" }
  for (azimuth in listOf(0.0, 90.0, 180.0, 359.9)) {
    val az = Math.toRadians(azimuth)
    val horizonView = doubleArrayOf(400.0, 600.0, 200.0,
      kotlin.math.cos(az), 0.0, -kotlin.math.sin(az), 0.0, 1.0, 0.0,
      kotlin.math.sin(az), 0.0, kotlin.math.cos(az))
    val seeds = selectProjectedMaskSeeds(256, 256, horizonView, listOf(Point(200.0, 299.0)), 36.0) {}
    val direction = seeds.single()
    check(kotlin.math.abs(direction.x - (128 + 128 * kotlin.math.sin(az))) <= 2)
    check(kotlin.math.abs(direction.y - (128 - 128 * kotlin.math.cos(az))) <= 2)
    check(selectProjectedMaskSeeds(256, 256, horizonView, listOf(Point(200.0, 320.0)), 36.0) {}.isEmpty())
  }
  var cancelled = false
  try { selectProjectedMaskSeeds(256, 256, view, listOf(Point(200.0, 300.0)), 36.0) { throw InterruptedException() } }
  catch (_: InterruptedException) { cancelled = true }
  check(cancelled)
  var oversized = false
  try { selectProjectedMaskSeeds(2048, 2048, view.copyOf().apply { this[2] = 0.01 },
    listOf(Point(0.0, 300.0), Point(400.0, 300.0)), 36.0) {} }
  catch (_: IllegalArgumentException) { oversized = true }
  check(oversized) { "Unbounded seed sampling was accepted" }
  val rgba = Mat(256, 256, CvType.CV_8UC4, org.opencv.core.Scalar(18.0, 22.0, 30.0, 255.0))
  val trunk = rgba.submat(org.opencv.core.Rect(124, 10, 9, 246))
  trunk.setTo(org.opencv.core.Scalar(8.0, 11.0, 14.0, 255.0)); trunk.release()
  try {
    ConnectedMaskSelection(rgba).use { selector ->
      val result = selector.select(tap) {}
      check(result[128 * 256 / 8].toInt() and 1 == 0) { "Large centre brush selected neighbouring sky" }
      check(result[(128 * 256 + 128) / 8].toInt() and 1 != 0)
    }
  } finally { rgba.release() }
}

private fun checkNarrowMaskFeatures() {
  val rgba = Mat(64, 64, CvType.CV_8UC4, org.opencv.core.Scalar(95.0, 145.0, 170.0, 255.0))
  val branch = rgba.submat(org.opencv.core.Rect(31, 0, 2, 64))
  branch.setTo(org.opencv.core.Scalar(20.0, 35.0, 45.0, 255.0)); branch.release()
  try {
    ConnectedMaskSelection(rgba).use { selector ->
      val result = selector.select(listOf(Point(31.0, 20.0))) {}
      fun selected(x: Int, y: Int) = result[(y * 64 + x) / 8].toInt() and (1 shl (x % 8)) != 0
      check((2..61).all { selected(31, it) && selected(32, it) }) { "Denoising lost a narrow contrasting branch" }
      check((2..61).none { selected(29, it) || selected(34, it) }) { "Narrow branch selection crossed into sky" }
    }
  } finally { rgba.release() }
}
