package com.cosmicpickle.astrovisibility.panorama

import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Point
import org.opencv.core.Rect
import org.opencv.core.Scalar
import org.opencv.imgproc.Imgproc
import java.io.Closeable

/** Original-resolution, four-connected magic wand. Owns its prepared matrices.
 * Fixed seed-relative Lab tolerance prevents a gradual colour ramp from leaking
 * across an entire image. Further brush seeds can extend a shaded selection.
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
  private var closed = false

  init {
    val rgb = Mat()
    val alpha = Mat()
    val interior = barriers.submat(Rect(1, 1, width, height))
    try {
      Imgproc.cvtColor(rgba, rgb, Imgproc.COLOR_RGBA2RGB)
      Imgproc.cvtColor(rgb, colours, Imgproc.COLOR_RGB2Lab)
      Core.extractChannel(rgba, alpha, 3)
      Core.compare(alpha, Scalar(0.0), interior, Core.CMP_EQ)
    } catch (error: Exception) {
      close()
      throw error
    } finally {
      rgb.release()
      alpha.release()
      interior.release()
    }
  }

  fun select(seeds: List<Point>, checkCancelled: () -> Unit): ByteArray {
    check(!closed)
    require(seeds.size in 1..256)
    require(seeds.all { it.x.isFinite() && it.y.isFinite() &&
      it.x >= 0 && it.x < width && it.y >= 0 && it.y < height })
    return grow(seeds.asSequence(), checkCancelled)
  }

  fun selectBrush(footprint: ByteArray, checkCancelled: () -> Unit): ByteArray {
    require(footprint.size == (width * height + 7) / 8)
    val seeds = sequence {
      for (y in 0 until height) {
        checkCancelled()
        for (x in 0 until width) {
          val pixel = y * width + x
          if (footprint[pixel / 8].toInt() and (1 shl (pixel % 8)) != 0)
            yield(Point(x.toDouble(), y.toDouble()))
        }
      }
    }
    return grow(seeds, checkCancelled)
  }

  private fun grow(seeds: Sequence<Point>, checkCancelled: () -> Unit): ByteArray {
    check(!closed)
    checkCancelled()
    val floodMask = barriers.clone()
    try {
      val tolerance = Scalar(24.0, 12.0, 12.0)
      val flags = 4 or Imgproc.FLOODFILL_FIXED_RANGE or
        Imgproc.FLOODFILL_MASK_ONLY or (2 shl 8)
      val visited = ByteArray((width + 2) * (height + 2))
      val row = ByteArray(width + 2)
      floodMask.get(0, 0, visited)
      var regions = 0
      for (seed in seeds) {
        checkCancelled()
        if (visited[(seed.y.toInt() + 1) * (width + 2) + seed.x.toInt() + 1] != 0.toByte()) continue
        check(++regions <= 512) { "Selection is too detailed; use a smaller brush" }
        val changed = Rect()
        Imgproc.floodFill(colours, floodMask, seed, Scalar(0.0), changed, tolerance, tolerance, flags)
        // Avoid a JNI call and double-array allocation for every brush pixel.
        for (y in changed.y until changed.y + changed.height) {
          floodMask.get(y + 1, 0, row)
          row.copyInto(visited, (y + 1) * (width + 2))
        }
      }
      val selected = ByteArray((width * height + 7) / 8)
      for (y in 0 until height) {
        checkCancelled()
        for (x in 0 until width) if (visited[(y + 1) * (width + 2) + x + 1] == 2.toByte()) {
          val pixel = y * width + x
          selected[pixel / 8] = (selected[pixel / 8].toInt() or (1 shl (pixel % 8))).toByte()
        }
      }
      return selected
    } finally {
      floodMask.release()
    }
  }

  override fun close() {
    if (closed) return
    closed = true
    colours.release()
    barriers.release()
  }
}
