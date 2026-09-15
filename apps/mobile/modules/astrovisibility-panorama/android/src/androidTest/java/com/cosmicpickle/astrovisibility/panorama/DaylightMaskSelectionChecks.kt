package com.cosmicpickle.astrovisibility.panorama

import android.util.Log
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Point

/** A shaded facade is one surface even when its far end differs from the tap. */
internal fun checkDaylightMaskSelection() {
  val width = 320
  val height = 240
  val pixels = ByteArray(width * height * 4)
  val random = java.util.Random(20260915L)
  for (y in 0 until height) for (x in 0 until width) {
    val wall = x in 60..259 && y >= 40
    val shade = (x - 60).coerceIn(0, 199) / 2
    val colour = if (wall) intArrayOf(85 + shade, 75 + shade, 65 + shade)
      else intArrayOf(80, 155, 225)
    for (channel in 0..2) pixels[(y * width + x) * 4 + channel] =
      (colour[channel] + random.nextInt(7) - 3).toByte()
    pixels[(y * width + x) * 4 + 3] = 255.toByte()
  }
  val rgba = Mat(height, width, CvType.CV_8UC4)
  rgba.put(0, 0, pixels)
  try {
    ConnectedMaskSelection(rgba).use { selector ->
      val dark = selector.select(listOf(Point(80.0, 100.0))) {}
      val bright = selector.select(listOf(Point(230.0, 100.0))) {}
      fun selected(bits: ByteArray, x: Int, y: Int): Boolean {
        val pixel = y * width + x
        return bits[pixel / 8].toInt() and (1 shl (pixel % 8)) != 0
      }
      var wallCount = 0; var darkHit = 0; var brightHit = 0; var skyLeak = 0
      for (y in 44 until height - 4) for (x in 4 until width - 4) {
        if (x in 64..255) {
          wallCount++
          if (selected(dark, x, y)) darkHit++
          if (selected(bright, x, y)) brightHit++
        } else if (x < 56 || x > 263) {
          if (selected(dark, x, y) || selected(bright, x, y)) skyLeak++
        }
      }
      Log.i("MaskEditorChecks", "Daylight wall=$darkHit/$wallCount bright=$brightHit/$wallCount skyLeak=$skyLeak")
      check(darkHit > wallCount * .995 && brightHit > wallCount * .995) {
        "Shading splits one connected facade into partial selections"
      }
      check(skyLeak == 0) { "Facade selection crossed its boundary into sky" }
    }
  } finally { rgba.release() }
}
