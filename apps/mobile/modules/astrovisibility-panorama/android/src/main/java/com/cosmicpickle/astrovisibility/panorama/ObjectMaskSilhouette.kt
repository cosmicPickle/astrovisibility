package com.cosmicpickle.astrovisibility.panorama

import org.opencv.core.*
import org.opencv.imgproc.Imgproc

/** Fill windows/canopy holes while retaining exterior concavities. */
internal fun solidObjectMask(confidence: FloatArray, width: Int, height: Int): Mat {
  require(width in 1..768 && height in 1..768 && confidence.size == width * height)
  require(confidence.all { it.isFinite() })
  val binary = Mat(height, width, CvType.CV_8UC1)
  val result = Mat.zeros(height, width, CvType.CV_8UC1)
  val hierarchy = Mat()
  val kernel = Imgproc.getStructuringElement(Imgproc.MORPH_ELLIPSE, Size(5.0, 5.0))
  val contours = ArrayList<MatOfPoint>()
  try {
    binary.put(0, 0, ByteArray(confidence.size) { if (confidence[it] >= 0.5f) 255.toByte() else 0 })
    Imgproc.morphologyEx(binary, binary, Imgproc.MORPH_CLOSE, kernel)
    Imgproc.findContours(binary, contours, hierarchy, Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
    for (contour in contours) {
      if (Imgproc.contourArea(contour) < 9) continue
      val curve = MatOfPoint2f(*contour.toArray())
      val simplified = MatOfPoint2f()
      val outline = MatOfPoint()
      try {
        Imgproc.approxPolyDP(curve, simplified, 1.0, true)
        outline.fromArray(*simplified.toArray())
        Imgproc.drawContours(result, listOf(outline), -1, Scalar(255.0), Imgproc.FILLED)
      } finally { curve.release(); simplified.release(); outline.release() }
    }
    return result
  } catch (error: Exception) {
    result.release()
    throw error
  } finally {
    binary.release(); hierarchy.release(); kernel.release()
    contours.forEach { it.release() }
  }
}
