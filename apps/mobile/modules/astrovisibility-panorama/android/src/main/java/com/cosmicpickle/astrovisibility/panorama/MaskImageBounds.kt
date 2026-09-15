package com.cosmicpickle.astrovisibility.panorama

import android.graphics.Bitmap
import android.graphics.Rect

/** Exclude the black frame of an incomplete panorama from the model's image. */
internal fun coveredImageBounds(bitmap: Bitmap): Rect {
  val row = IntArray(bitmap.width)
  var left = bitmap.width; var top = bitmap.height
  var right = 0; var bottom = 0
  for (y in 0 until bitmap.height) {
    bitmap.getPixels(row, 0, bitmap.width, 0, y, bitmap.width, 1)
    for (x in row.indices) if (row[x] ushr 24 != 0) {
      left = minOf(left, x); top = minOf(top, y)
      right = maxOf(right, x + 1); bottom = maxOf(bottom, y + 1)
    }
  }
  require(left < right && top < bottom) { "No captured image in this view" }
  return Rect(left, top, right, bottom)
}
