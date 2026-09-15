package com.cosmicpickle.astrovisibility.panorama

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import org.json.JSONArray
import java.io.File

internal data class PanoramaInputs(val paths: Array<String>, val placements: DoubleArray)

internal fun prepareInputs(
  context: Context,
  json: String,
  directory: File,
  checkCancelled: () -> Unit,
  progress: (Int, Int) -> Unit
): PanoramaInputs {
  require(json.length <= 500_000)
  val entries = JSONArray(json)
  require(entries.length() in 1..200)
  val placements = DoubleArray(entries.length() * 5)
  val roots = listOf(context.filesDir.canonicalFile, context.cacheDir.canonicalFile)
  val paths = Array(entries.length()) { index ->
    checkCancelled()
    progress(index, entries.length())
    val entry = entries.getJSONObject(index)
    val uri = Uri.parse(entry.getString("uri"))
    require(uri.scheme == "file")
    val source = File(requireNotNull(uri.path)).canonicalFile
    require(roots.any { source.path.startsWith(it.path + File.separator) })
    require(source.isFile && source.length() in 1..32L * 1024 * 1024)
    val placement = entry.getJSONObject("reviewedPlacement")
    val keys = arrayOf("centerAzimuthDegrees", "centerAltitudeDegrees", "rollDegrees",
      "horizontalFieldOfViewDegrees", "verticalFieldOfViewDegrees")
    keys.forEachIndexed { offset, key ->
      val value = placement.getDouble(key)
      require(value.isFinite())
      require(when (offset) {
        0 -> value >= 0 && value < 360
        1 -> value in -90.0..90.0
        2 -> value in -180.0..180.0
        else -> value > 0.0 && value < 180.0
      })
      placements[index * 5 + offset] = value
    }
    val output = File(directory, "source-$index.jpg")
    sampleImage(source, output)
    output.path
  }
  return PanoramaInputs(paths, placements)
}

private fun sampleImage(source: File, output: File) {
  val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
  BitmapFactory.decodeFile(source.path, options)
  require(options.outWidth in 1..12000 && options.outHeight in 1..12000)
  require(options.outWidth.toLong() * options.outHeight <= 40_000_000)
  options.inJustDecodeBounds = false
  options.inSampleSize = 1
  options.inPreferredConfig = Bitmap.Config.ARGB_8888
  while (maxOf(options.outWidth, options.outHeight) / (options.inSampleSize * 2) >= 1024) {
    options.inSampleSize *= 2
  }
  var bitmap = requireNotNull(BitmapFactory.decodeFile(source.path, options))
  try {
    val orientation = ExifInterface(source.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1)
    val transform = Matrix().apply {
      when (orientation) {
        2 -> setScale(-1f, 1f)
        3 -> setRotate(180f)
        4 -> setScale(1f, -1f)
        5 -> { setRotate(90f); postScale(-1f, 1f) }
        6 -> setRotate(90f)
        7 -> { setRotate(-90f); postScale(-1f, 1f) }
        8 -> setRotate(-90f)
      }
      val scale = minOf(1f, 1024f / maxOf(bitmap.width, bitmap.height))
      postScale(scale, scale)
    }
    val upright = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, transform, true)
    if (upright !== bitmap) { bitmap.recycle(); bitmap = upright }
    output.outputStream().use { require(bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it)) }
  } finally {
    bitmap.recycle()
  }
}
