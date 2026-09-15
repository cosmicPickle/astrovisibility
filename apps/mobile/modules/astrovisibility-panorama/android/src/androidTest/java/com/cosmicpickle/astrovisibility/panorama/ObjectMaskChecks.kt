package com.cosmicpickle.astrovisibility.panorama

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import org.opencv.core.Point
import kotlin.math.*

/** Object silhouettes deliberately cover windows and canopy holes. */
internal fun checkObjectMaskGeometry() {
  val partial = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888)
  partial.setPixel(4, 6, Color.BLACK)
  partial.setPixel(24, 28, Color.WHITE)
  check(coveredImageBounds(partial) == android.graphics.Rect(4, 6, 25, 29))
  partial.eraseColor(Color.TRANSPARENT)
  var rejected = false
  try { coveredImageBounds(partial) } catch (_: IllegalArgumentException) { rejected = true }
  check(rejected)
  partial.recycle()
  val size = 96
  val confidence = FloatArray(size * size)
  for (y in 12..80) for (x in 12..80) {
    val window = x in 25..34 && y in 30..39
    val exteriorNotch = x in 48..64 && y < 50
    if (!window && !exteriorNotch) confidence[y * size + x] = 0.9f
  }
  confidence[4 * size + 4] = 1f
  val silhouette = solidObjectMask(confidence, size, size)
  try {
    check(silhouette.get(35, 30)[0] == 255.0) { "Object window was left as a hole" }
    check(silhouette.get(24, 55)[0] == 0.0) { "Exterior concavity became a convex hull" }
    check(silhouette.get(4, 4)[0] == 0.0) { "Isolated selection noise remains" }
    check(silhouette.get(65, 65)[0] == 255.0)
  } finally { silhouette.release() }

  for (azimuth in listOf(0.0, 90.0, 180.0, 359.9)) for (altitude in listOf(0.0, 45.0, 90.0)) {
    val az = Math.toRadians(azimuth); val alt = Math.toRadians(altitude)
    val view = doubleArrayOf(400.0, 600.0, 300.0,
      cos(az), 0.0, -sin(az), -sin(az) * sin(alt), cos(alt), -cos(az) * sin(alt),
      sin(az) * cos(alt), sin(alt), cos(az) * cos(alt))
    val perspective = MaskPerspective(view, Point(200.0, 300.0), 110.0)
    for (screen in listOf(Point(200.0, 260.0), Point(160.0, 280.0), Point(240.0, 250.0))) {
      val atlas = projectMaskAtlasPoint(512, 512, view, screen.x, screen.y) ?: continue
      val expected = requireNotNull(perspective.screenToPatch(screen))
      val actual = requireNotNull(perspective.atlasToPatch(512, 512, atlas.x, atlas.y))
      check(hypot(actual.x - expected.x, actual.y - expected.y) < 0.001) { "Mask perspective lost directional alignment" }
    }
  }
}

/** A narrow captured building must not turn into selection of the photograph frame. */
internal fun checkPartialObjectMask(context: Context) {
  val photograph = Bitmap.createBitmap(768, 768, Bitmap.Config.ARGB_8888)
  val canvas = Canvas(photograph)
  canvas.drawColor(Color.rgb(120, 190, 240))
  val paint = Paint().apply { color = Color.rgb(160, 60, 30) }
  canvas.drawRect(250f, 300f, 550f, 650f, paint)
  paint.color = Color.DKGRAY
  canvas.drawPath(android.graphics.Path().apply {
    moveTo(220f, 300f); lineTo(400f, 120f); lineTo(580f, 300f); close()
  }, paint)
  paint.color = Color.rgb(250, 240, 200)
  canvas.drawRect(360f, 390f, 420f, 470f, paint)
  val diagonal = sqrt(.5)
  val view = doubleArrayOf(400.0, 600.0, 300.0, 1.0, 0.0, 0.0,
    0.0, diagonal, -diagonal, 0.0, diagonal, diagonal)
  val camera = MaskPerspective(view, Point(200.0, 300.0), 75.0)
  val source = IntArray(512 * 512)
  val foreground = ArrayList<Int>(); val background = ArrayList<Int>()
  for (y in 0 until 512) for (x in 0 until 512) {
    val image = camera.atlasToPatch(512, 512, x + .5, y + .5) ?: continue
    val column = image.x.toInt(); val row = image.y.toInt()
    if (column !in 0..767 || row !in 0..767) continue
    val index = y * 512 + x
    source[index] = photograph.getPixel(column, row)
    if (column in 300..500 && row in 350..550) foreground.add(index)
    if (column in 30..150 && row in 150..600) background.add(index)
  }
  val atlas = Bitmap.createBitmap(source, 512, 512, Bitmap.Config.ARGB_8888)
  try {
    ObjectMaskSelection(context, atlas).use { selector ->
      val selection = selector.select(view, listOf(Point(200.0, 300.0)), 16.0) {}
      fun selected(index: Int) = selection[index / 8].toInt() and (1 shl (index % 8)) != 0
      check(foreground.count { selected(it) } > foreground.size * .95) { "Building or window fragmented" }
      check(background.count { selected(it) } < background.size * .05) { "Captured frame selected instead of building" }
      check(source.indices.none { source[it] == 0 && selected(it) }) { "Selection escaped capture coverage" }
    }
  } finally { atlas.recycle(); photograph.recycle() }
}

/** Execute the shipped model, including a second stroke on cached embeddings. */
internal fun checkObjectMaskModel(context: Context) {
  val image = Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888)
  val canvas = Canvas(image)
  val paint = Paint().apply { color = Color.rgb(100, 175, 230) }
  canvas.drawCircle(128f, 128f, 124f, paint)
  paint.color = Color.rgb(70, 130, 40)
  canvas.drawCircle(128f, 128f, 42f, paint)
  val view = doubleArrayOf(400.0, 600.0, 300.0, 1.0, 0.0, 0.0,
    0.0, 0.0, -1.0, 0.0, 1.0, 0.0)
  val started = System.nanoTime()
  try {
    ObjectMaskSelection(context, image).use { selector ->
      val first = selector.select(view, listOf(Point(200.0, 300.0)), 16.0) {}
      val firstDone = System.nanoTime()
      val second = selector.select(view, listOf(Point(205.0, 300.0)), 16.0) {}
      check(first.any { it != 0.toByte() } && second.any { it != 0.toByte() }) { "Bundled model returned no object" }
      check(first[0] == 0.toByte() && second[0] == 0.toByte()) { "Model painted outside captured coverage" }
      var cancelled = false
      try { selector.select(view, listOf(Point(200.0, 300.0)), 16.0) { throw InterruptedException() } }
      catch (_: InterruptedException) { cancelled = true }
      check(cancelled)
      android.util.Log.i("MaskEditorChecks", "Object model first=${(firstDone - started) / 1_000_000}ms cached=${(System.nanoTime() - firstDone) / 1_000_000}ms")
    }
  } finally { image.recycle() }
}
