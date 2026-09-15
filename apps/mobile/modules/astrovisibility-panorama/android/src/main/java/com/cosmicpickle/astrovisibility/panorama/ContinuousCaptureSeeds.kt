package com.cosmicpickle.astrovisibility.panorama

import android.content.Context
import android.graphics.BitmapFactory
import org.opencv.android.Utils
import org.opencv.core.Mat
import org.opencv.imgproc.Imgproc
import java.io.File
import java.net.URI

/** Reopen persisted camera images using the same private-path and size bounds as capture. */
internal fun readCaptureSeed(context: Context, uri: String): Mat {
  val file = File(URI(uri)).canonicalFile
  require(file.path.startsWith(context.filesDir.canonicalPath + File.separator) ||
    file.path.startsWith(context.cacheDir.canonicalPath + File.separator))
  require(file.isFile && file.length() in 1..(32L * 1024 * 1024))
  val options = BitmapFactory.Options().apply { inJustDecodeBounds = true; inSampleSize = 1 }
  BitmapFactory.decodeFile(file.path, options)
  require(options.outWidth in 1..12000 && options.outHeight in 1..12000 &&
    options.outWidth.toLong() * options.outHeight <= 40_000_000)
  options.inJustDecodeBounds = false
  while ((maxOf(options.outWidth, options.outHeight) + options.inSampleSize - 1) / options.inSampleSize > 640) options.inSampleSize *= 2
  val bitmap = BitmapFactory.decodeFile(file.path, options) ?: error("Invalid draft image")
  val rgba = Mat(); val gray = Mat()
  try {
    Utils.bitmapToMat(bitmap, rgba); Imgproc.cvtColor(rgba, gray, Imgproc.COLOR_RGBA2GRAY)
    return gray
  } catch (error: Exception) { gray.release(); throw error }
  finally { rgba.release(); bitmap.recycle() }
}
