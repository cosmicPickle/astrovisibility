package com.cosmicpickle.astrovisibility.panorama

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Rect
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.tasks.components.containers.NormalizedKeypoint
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.interactivesegmenter.InteractiveSegmenter
import com.google.mediapipe.tasks.vision.interactivesegmenter.InteractiveSegmenterOptions
import com.google.mediapipe.tasks.vision.interactivesegmenter.Stroke
import org.opencv.core.Point
import java.io.Closeable

/** One offline model and cached perspective embedding, owned by the native worker. */
internal class ObjectMaskSelection(context: Context, bitmap: Bitmap) : Closeable {
  private val width = bitmap.width
  private val height = bitmap.height
  private val pixels = IntArray(width * height)
  private val segmenter: InteractiveSegmenter
  private var perspective: MaskPerspective? = null
  private var lookup: IntArray? = null
  private var cachedImage: MPImage? = null
  private var imageBounds = Rect()
  private var closed = false

  init {
    require(width in 1..2048 && height in 1..2048)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    segmenter = InteractiveSegmenter.createFromOptions(context,
      InteractiveSegmenterOptions.builder().setBaseOptions(BaseOptions.builder()
        .setModelAssetPath("interactive_segmentation.task").build()).build())
  }

  fun select(view: DoubleArray, points: List<Point>, radius: Double, checkCancelled: () -> Unit): ByteArray {
    check(!closed)
    validateMaskBrush(width, height, view, points, radius)
    checkCancelled()
    val covered = points.filter { point ->
      if (point.x !in 0.0..view[0] || point.y !in 0.0..view[1]) return@filter false
      val atlas = projectMaskAtlasPoint(width, height, view, point.x, point.y) ?: return@filter false
      val x = atlas.x.toInt(); val y = atlas.y.toInt()
      x in 0 until width && y in 0 until height && pixels[y * width + x] ushr 24 != 0
    }
    if (covered.isEmpty()) return ByteArray((width * height + 7) / 8)
    val center = Point((covered.minOf { it.x } + covered.maxOf { it.x }) / 2,
      (covered.minOf { it.y } + covered.maxOf { it.y }) / 2)
    var patch = perspective
    if (patch == null || !patch.view.contentEquals(view) || covered.any {
        val projected = patch?.screenToPatch(it)
        projected == null || projected.x !in 64.0..704.0 || projected.y !in 64.0..704.0
      }) {
      patch = prepare(view, center, 110.0, checkCancelled)
    }
    var selection = segment(requireNotNull(patch), covered, checkCancelled)
    // A whole object may extend past the first view; make one bounded retry.
    if (patch.fieldOfViewDegrees < 140.0 && touchesBoundary(selection, patch.size)) {
      patch = prepare(view, center, 140.0, checkCancelled)
      selection = segment(patch, covered, checkCancelled)
    }
    val mapping = requireNotNull(lookup)
    val result = ByteArray((width * height + 7) / 8)
    for (y in 0 until height) {
      checkCancelled()
      for (x in 0 until width) {
        val pixel = y * width + x
        val mapped = mapping[pixel]
        if (mapped >= 0 && selection[mapped] != 0.toByte())
          result[pixel / 8] = (result[pixel / 8].toInt() or (1 shl (pixel % 8))).toByte()
      }
    }
    return result
  }

  private fun prepare(view: DoubleArray, center: Point, fieldOfView: Double, checkCancelled: () -> Unit): MaskPerspective {
    perspective = null; lookup = null
    val patch = MaskPerspective(view.copyOf(), center, fieldOfView)
    val bitmap = patch.render(pixels, width, height, checkCancelled)
    val bounds = coveredImageBounds(bitmap)
    val cropped = Bitmap.createBitmap(bitmap, bounds.left, bounds.top, bounds.width(), bounds.height())
    if (cropped !== bitmap) bitmap.recycle()
    val image = BitmapImageBuilder(cropped).build()
    try { segmenter.setImage(image) } catch (error: Exception) { image.close(); throw error }
    cachedImage?.close()
    cachedImage = image
    imageBounds = bounds
    checkCancelled()
    lookup = patch.atlasLookup(pixels, width, height, checkCancelled)
    perspective = patch
    return patch
  }

  private fun segment(patch: MaskPerspective, points: List<Point>, checkCancelled: () -> Unit): ByteArray {
    val step = ((points.size + 127) / 128).coerceAtLeast(1)
    val prompt = points.filterIndexed { index, _ -> index % step == 0 || index == points.lastIndex }.map {
      val point = requireNotNull(patch.screenToPatch(it)) { "Use a shorter stroke" }
      NormalizedKeypoint.create(((point.x - imageBounds.left) / imageBounds.width()).toFloat().coerceIn(0f, 1f),
        ((point.y - imageBounds.top) / imageBounds.height()).toFloat().coerceIn(0f, 1f))
    }
    val stroke = Stroke.builder().setBrushMode(Stroke.BrushMode.POSITIVE).setPoints(prompt).setCompleted(true).build()
    checkCancelled()
    val output = segmenter.segment(listOf(stroke))
    try {
      require(output.width == imageBounds.width() && output.height == imageBounds.height())
      val confidence = FloatArray(output.width * output.height)
      ByteBufferExtractor.extract(output).asFloatBuffer().get(confidence)
      checkCancelled()
      val silhouette = solidObjectMask(confidence, output.width, output.height)
      try {
        val cropped = ByteArray(confidence.size).also { silhouette.get(0, 0, it) }
        return ByteArray(patch.size * patch.size).also { result ->
          for (row in 0 until output.height) cropped.copyInto(result,
            (row + imageBounds.top) * patch.size + imageBounds.left, row * output.width, (row + 1) * output.width)
        }
      }
      finally { silhouette.release() }
    } finally { output.close() }
  }

  private fun touchesBoundary(mask: ByteArray, size: Int): Boolean =
    (0 until size).any { mask[it] != 0.toByte() || mask[(size - 1) * size + it] != 0.toByte() ||
      mask[it * size] != 0.toByte() || mask[it * size + size - 1] != 0.toByte() }

  override fun close() {
    if (closed) return
    closed = true
    perspective = null; lookup = null
    try { segmenter.close() } finally {
      cachedImage?.close()
      cachedImage = null
    }
  }
}
