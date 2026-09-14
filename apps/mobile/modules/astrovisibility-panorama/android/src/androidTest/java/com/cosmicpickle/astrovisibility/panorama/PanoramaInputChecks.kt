package com.cosmicpickle.astrovisibility.panorama

import android.app.Activity
import android.app.Instrumentation
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.os.Bundle
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile

/** Android platform input/EXIF checks, without a new test-library dependency. */
class PanoramaInputChecks : Instrumentation() {
  override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); start() }
  override fun onStart() {
    val status = Bundle().apply {
      putString("class", this@PanoramaInputChecks.javaClass.name)
      putString("test", "validatesLocalImageInputs")
      putInt("numtests", 1)
      putInt("current", 1)
    }
    sendStatus(1, status)
    val directory = File(targetContext.cacheDir, "panorama-input-checks")
    directory.mkdirs()
    try {
      val source = File(directory, "source.jpg")
      val bitmap = Bitmap.createBitmap(320, 180, Bitmap.Config.ARGB_8888)
      source.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it)) }
      bitmap.recycle()
      ExifInterface(source.path).apply {
        setAttribute(ExifInterface.TAG_ORIENTATION, "6")
        saveAttributes()
      }
      fun input(uri: String = source.toURI().toString(), altitude: Double = 90.0) = JSONObject()
        .put("uri", uri).put("reviewedPlacement", JSONObject()
          .put("centerAzimuthDegrees", 359.0).put("centerAltitudeDegrees", altitude)
          .put("rollDegrees", 12.0).put("horizontalFieldOfViewDegrees", 60.0)
          .put("verticalFieldOfViewDegrees", 45.0))
      fun prepare(entries: JSONArray) = prepareInputs(targetContext, entries.toString(), directory, {}, { _, _ -> })
      fun rejects(block: () -> Unit) {
        var rejected = false
        try { block() } catch (_: IllegalArgumentException) { rejected = true }
        check(rejected) { "Invalid source was accepted" }
      }
      val prepared = prepare(JSONArray().put(input()))
      val decoded = BitmapFactory.decodeFile(prepared.paths[0])
      check(decoded.width == 180 && decoded.height == 320) { "EXIF rotation was lost" }
      decoded.recycle()
      rejects { prepare(JSONArray().put(input("file:///sdcard/outside.jpg"))) }
      rejects { prepare(JSONArray().put(input("https://example.com/photo.jpg"))) }
      rejects { prepare(JSONArray().put(input(altitude = 91.0))) }
      rejects { prepare(JSONArray()) }
      rejects { prepare(JSONArray().apply { repeat(201) { put(input()) } }) }
      val corrupt = File(directory, "corrupt.jpg").apply { writeText("invalid image") }
      rejects { prepare(JSONArray().put(input(corrupt.toURI().toString()))) }
      val large = File(directory, "large.jpg")
      RandomAccessFile(large, "rw").use { it.setLength(33L * 1024 * 1024) }
      rejects { prepare(JSONArray().put(input(large.toURI().toString()))) }
      sendStatus(0, status)
      finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Panorama Android input checks passed\n") })
    } catch (_: Exception) {
      status.putString("stack", "Panorama Android input checks failed")
      sendStatus(-2, status)
      finish(Activity.RESULT_CANCELED, Bundle().apply { putString("stream", "Panorama Android input checks failed\n") })
    } finally {
      directory.deleteRecursively()
    }
  }
}
