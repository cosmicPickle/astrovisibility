package com.cosmicpickle.astrovisibility.panorama

import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Point
import org.opencv.core.Rect
import org.opencv.core.Scalar
import org.opencv.imgproc.Imgproc
import java.io.Closeable

/** Original-resolution, edge-constrained wand. Owns its prepared matrices.
 * Denoising and boundary detection are cached for the editing session. A bounded
 * seed-relative colour range prevents a gradual ramp leaking across the image.
 * https://docs.opencv.org/4.13.0/d7/d1b/group__imgproc__misc.html
 */
internal class ConnectedMaskSelection(rgba: Mat) : Closeable {
  private val width = rgba.cols()
  private val height = rgba.rows()
  init {
    require(width in 1..2048 && height in 1..2048 && rgba.type() == CvType.CV_8UC4)
  }
  private val colours = Mat()
  private val barriers = Mat.zeros(height + 2, width + 2, CvType.CV_8UC1)
  private val colourPixels = ByteArray(width * height * 3)
  private var closed = false

  init {
    val rgb = Mat()
    val alpha = Mat()
    val filtered = Mat()
    val luminance = Mat()
    val edges = Mat()
    val interior = barriers.submat(Rect(1, 1, width, height))
    try {
      Imgproc.cvtColor(rgba, rgb, Imgproc.COLOR_RGBA2RGB)
      // Small spatial support keeps narrow contrasting branches while reducing
      // low-light sensor noise. Work at the original panorama resolution.
      Imgproc.pyrMeanShiftFiltering(rgb, filtered, 4.0, 12.0, 0)
      Imgproc.cvtColor(filtered, colours, Imgproc.COLOR_RGB2Lab)
      colours.get(0, 0, colourPixels)
      Core.extractChannel(colours, luminance, 0)
      Imgproc.Canny(luminance, edges, 8.0, 20.0, 3, true)
      Imgproc.threshold(edges, edges, 0.0, 1.0, Imgproc.THRESH_BINARY)
      removeIsolatedMaskEdges(edges)
      Core.extractChannel(rgba, alpha, 3)
      Core.compare(alpha, Scalar(0.0), interior, Core.CMP_EQ)
      Core.bitwise_or(interior, edges, interior)
    } catch (error: Exception) {
      close()
      throw error
    } finally {
      rgb.release()
      alpha.release()
      filtered.release()
      luminance.release()
      edges.release()
      interior.release()
    }
  }

  fun select(seeds: List<Point>, checkCancelled: () -> Unit): ByteArray {
    check(!closed)
    require(seeds.size in 1..4096)
    require(seeds.all { it.x.isFinite() && it.y.isFinite() &&
      it.x >= 0 && it.x < width && it.y >= 0 && it.y < height })
    return grow(seeds.asSequence(), checkCancelled)
  }

  private fun grow(seeds: Sequence<Point>, checkCancelled: () -> Unit): ByteArray {
    check(!closed)
    checkCancelled()
    val floodMask = barriers.clone()
    try {
      val flags = 4 or Imgproc.FLOODFILL_FIXED_RANGE or
        Imgproc.FLOODFILL_MASK_ONLY or (2 shl 8)
      val visited = ByteArray((width + 2) * (height + 2))
      val row = ByteArray(width + 2)
      floodMask.get(0, 0, visited)
      var regions = 0
      for (seed in seeds) {
        checkCancelled()
        if (visited[(seed.y.toInt() + 1) * (width + 2) + seed.x.toInt() + 1] != 0.toByte()) continue
        val seedOffset = (seed.y.toInt() * width + seed.x.toInt()) * 3
        val original = colourPixels.copyOfRange(seedOffset, seedOffset + 3)
        val reference = referenceColour(seed)
        val lightness = reference[0].toInt() and 255
        val tolerance = Scalar((4.0 + lightness * 0.12).coerceIn(6.0, 18.0), 8.0, 8.0)
        check(++regions <= 512) { "Selection is too detailed; use a smaller brush" }
        val changed = Rect()
        // Fixed-range floodFill compares against the seed pixel. Temporarily use
        // its local, same-surface colour estimate; the worker is serial and the
        // cached image is restored even if OpenCV fails.
        colours.put(seed.y.toInt(), seed.x.toInt(), reference)
        try {
          Imgproc.floodFill(colours, floodMask, seed, Scalar(0.0), changed, tolerance, tolerance, flags)
        } finally { colours.put(seed.y.toInt(), seed.x.toInt(), original) }
        // Avoid a JNI call and double-array allocation for every brush pixel.
        for (y in changed.y until changed.y + changed.height) {
          floodMask.get(y + 1, 0, row)
          row.copyInto(visited, (y + 1) * (width + 2))
        }
      }
      val selected = ByteArray((width * height + 7) / 8)
      for (y in 0 until height) {
        checkCancelled()
        for (x in 0 until width) if (isSelected(visited, x, y)) {
          val pixel = y * width + x
          selected[pixel / 8] = (selected[pixel / 8].toInt() or (1 shl (pixel % 8))).toByte()
        }
      }
      return selected
    } finally {
      floodMask.release()
    }
  }

  private fun referenceColour(seed: Point): ByteArray {
    val center = (seed.y.toInt() * width + seed.x.toInt()) * 3
    val sum = IntArray(3)
    var count = 0
    for (y in maxOf(0, seed.y.toInt() - 2)..minOf(height - 1, seed.y.toInt() + 2)) {
      for (x in maxOf(0, seed.x.toInt() - 2)..minOf(width - 1, seed.x.toInt() + 2)) {
        val offset = (y * width + x) * 3
        if ((0..2).any { kotlin.math.abs((colourPixels[offset + it].toInt() and 255) -
            (colourPixels[center + it].toInt() and 255)) > 4 }) continue
        count++
        for (channel in 0..2) sum[channel] += colourPixels[offset + channel].toInt() and 255
      }
    }
    return ByteArray(3) { ((sum[it] + count / 2) / count).toByte() }
  }

  private fun isSelected(visited: ByteArray, x: Int, y: Int): Boolean {
    val index = (y + 1) * (width + 2) + x + 1
    if (visited[index] == 2.toByte()) return true
    if (visited[index] != 1.toByte()) return false
    // Canny places its one-pixel boundary on either side of a transition. Return
    // a boundary pixel only when it closely matches an adjacent selected pixel;
    // this restores that side without growing across the edge or closing gaps.
    val pixel = y * width + x
    for (offset in intArrayOf(-1, 1, -width - 2, width + 2)) {
      if (visited[index + offset] != 2.toByte()) continue
      val neighbour = when (offset) {
        -1 -> pixel - 1
        1 -> pixel + 1
        -width - 2 -> pixel - width
        else -> pixel + width
      }
      if ((0..2).all { channel -> kotlin.math.abs(
          (colourPixels[pixel * 3 + channel].toInt() and 255) -
          (colourPixels[neighbour * 3 + channel].toInt() and 255)) <= 2 }) return true
    }
    return false
  }

  override fun close() {
    if (closed) return
    closed = true
    colours.release()
    barriers.release()
  }
}

/** Remove short, isolated edge responses before region growth, not holes or
 * branches in the resulting mask. Colour limits still constrain every fill. */
private fun removeIsolatedMaskEdges(edges: Mat) {
  val labels = Mat()
  try {
    val count = Imgproc.connectedComponents(edges, labels, 8, CvType.CV_32S)
    val lengths = IntArray(count)
    val rowLabels = IntArray(edges.cols())
    val rowEdges = ByteArray(edges.cols())
    for (y in 0 until edges.rows()) {
      labels.get(y, 0, rowLabels)
      for (label in rowLabels) if (label != 0) lengths[label]++
    }
    for (y in 0 until edges.rows()) {
      labels.get(y, 0, rowLabels)
      for (x in rowLabels.indices) rowEdges[x] =
        if (rowLabels[x] != 0 && lengths[rowLabels[x]] >= 64) 1 else 0
      edges.put(y, 0, rowEdges)
    }
  } finally { labels.release() }
}
