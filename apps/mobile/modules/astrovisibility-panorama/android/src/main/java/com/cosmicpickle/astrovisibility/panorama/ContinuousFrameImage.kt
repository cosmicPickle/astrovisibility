package com.cosmicpickle.astrovisibility.panorama

import android.graphics.Bitmap
import android.media.Image
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.imgproc.Imgproc

internal fun rotateCapture(source: Mat, target: Mat, rotationDegrees: Int) =
  Core.rotate(source, target, if (rotationDegrees == 90) Core.ROTATE_90_CLOCKWISE else Core.ROTATE_90_COUNTERCLOCKWISE)

private fun copyPlane(image: Image, planeIndex: Int): ByteArray {
  val plane = image.planes[planeIndex]
  val width = if (planeIndex == 0) image.width else image.width / 2
  val height = if (planeIndex == 0) image.height else image.height / 2
  val buffer = plane.buffer.duplicate()
  val start = buffer.position()
  return ByteArray(width * height) { index ->
    buffer.get(start + index / width * plane.rowStride + index % width * plane.pixelStride)
  }
}

internal fun captureGray(image: Image, rotation: Int): Mat {
  val source = Mat(image.height, image.width, CvType.CV_8UC1)
  val target = Mat()
  try { source.put(0, 0, copyPlane(image, 0)); rotateCapture(source, target, rotation) }
  finally { source.release() }
  return target
}

internal fun captureBitmap(image: Image, rotation: Int): Bitmap {
  val luminance = copyPlane(image, 0); val u = copyPlane(image, 1); val v = copyPlane(image, 2)
  val bytes = ByteArray(luminance.size + u.size + v.size)
  luminance.copyInto(bytes)
  for (index in u.indices) { bytes[luminance.size + index * 2] = v[index]; bytes[luminance.size + index * 2 + 1] = u[index] }
  val yuv = Mat(image.height * 3 / 2, image.width, CvType.CV_8UC1)
  val rgba = Mat(); val portrait = Mat()
  try {
    yuv.put(0, 0, bytes); Imgproc.cvtColor(yuv, rgba, Imgproc.COLOR_YUV2RGBA_NV21)
    rotateCapture(rgba, portrait, rotation)
    return Bitmap.createBitmap(portrait.cols(), portrait.rows(), Bitmap.Config.ARGB_8888).also { Utils.matToBitmap(portrait, it) }
  } finally { yuv.release(); rgba.release(); portrait.release() }
}
