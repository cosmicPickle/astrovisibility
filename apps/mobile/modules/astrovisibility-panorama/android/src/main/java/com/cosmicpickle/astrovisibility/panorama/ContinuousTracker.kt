package com.cosmicpickle.astrovisibility.panorama

import org.opencv.calib3d.Calib3d
import org.opencv.core.*
import org.opencv.features2d.BFMatcher
import org.opencv.features2d.ORB
import org.opencv.imgproc.Imgproc
import kotlin.math.*

internal class TrackedCapture(
  val points: Array<KeyPoint>, val descriptors: Mat, val basis: DoubleArray,
  val sensorBasis: DoubleArray, val intrinsics: DoubleArray,
  val status: String, val accept: Boolean,
) : AutoCloseable {
  override fun close() = descriptors.release()
}

/** Single-worker, bounded spherical landmark map; no image buffers are retained. */
internal class ContinuousTracker : AutoCloseable {
  private val orb = ORB.create(900)
  private val matcher = BFMatcher.create(Core.NORM_HAMMING, false)
  private val references = mutableListOf<TrackedCapture>()
  val size get() = references.size

  fun analyze(gray: Mat, sensor: DoubleArray, horizontalFov: Double, verticalFov: Double): TrackedCapture {
    val small = Mat()
    val scale = min(1.0, 640.0 / max(gray.cols(), gray.rows()))
    Imgproc.resize(gray, small, Size(gray.cols() * scale, gray.rows() * scale), 0.0, 0.0, Imgproc.INTER_AREA)
    val keypoints = MatOfKeyPoint(); val descriptors = Mat(); val mask = Mat()
    val laplacian = Mat(); val mean = MatOfDouble(); val deviation = MatOfDouble()
    val intrinsics = CaptureBasis.intrinsic(small.cols(), small.rows(), horizontalFov, verticalFov)
    try {
      Imgproc.Laplacian(small, laplacian, CvType.CV_64F)
      Core.meanStdDev(laplacian, mean, deviation)
      orb.detectAndCompute(small, mask, keypoints, descriptors)
      val points = keypoints.toArray()
      fun result(basis: DoubleArray, status: String, accept: Boolean = false) =
        TrackedCapture(points, descriptors, basis, sensor, intrinsics, status, accept)
      if (points.size < 35 || deviation.toArray()[0] < 4.0) return result(sensor, "detail")
      var corrected = sensor
      if (references.isNotEmpty()) {
        val candidates = references.sortedBy { CaptureBasis.angleDegrees(it.sensorBasis, sensor) }.take(6)
        var best: Pair<DoubleArray, Int>? = null
        for (reference in candidates) {
          val fit = match(points, descriptors, intrinsics, reference) ?: continue
          if (CaptureBasis.angleDegrees(fit.first, sensor) > 35.0) continue
          if (best == null || fit.second > best.second) best = fit
        }
        if (best == null) return result(sensor, "lost")
        corrected = best.first
      }
      if (CaptureBasis.placement(corrected)[1] < 0) return result(corrected, "horizon")
      if (references.size >= 96) return result(corrected, "capacity")
      val spacing = min(horizontalFov, verticalFov) * 0.24
      val novel = references.none { CaptureBasis.centerAngleDegrees(it.basis, corrected) < spacing &&
        CaptureBasis.angleDegrees(it.basis, corrected) < 22.0 }
      return result(corrected, "tracking", novel)
    } finally {
      small.release(); keypoints.release(); mask.release(); laplacian.release(); mean.release(); deviation.release()
    }
  }

  fun retain(frame: TrackedCapture) {
    check(references.size < 96)
    references.add(frame)
  }

  fun seed(gray: Mat, basis: DoubleArray, horizontalFov: Double, verticalFov: Double) {
    // Existing drafts retain their persisted placement, not a new sensor anchor.
    val temporary = ContinuousTracker()
    try {
      val frame = temporary.analyze(gray, basis, horizontalFov, verticalFov)
      if (frame.points.size >= 35 && references.size < 96) retain(frame) else frame.close()
    } finally { temporary.close() }
  }

  private fun match(points: Array<KeyPoint>, descriptors: Mat, intrinsics: DoubleArray,
    reference: TrackedCapture): Pair<DoubleArray, Int>? {
    val matches = mutableListOf<MatOfDMatch>()
    val currentPoints = MatOfPoint2f(); val referencePoints = MatOfPoint2f(); val inliers = Mat()
    var homography: Mat? = null
    try {
      matcher.knnMatch(descriptors, reference.descriptors, matches, 2)
      val good = matches.mapNotNull { row -> row.toArray().let {
        if (it.size == 2 && it[0].distance < it[1].distance * 0.72) it[0] else null
      } }.distinctBy { it.trainIdx }
      if (good.size < 18) return null
      currentPoints.fromArray(*good.map { points[it.queryIdx].pt }.toTypedArray())
      referencePoints.fromArray(*good.map { reference.points[it.trainIdx].pt }.toTypedArray())
      homography = Calib3d.findHomography(currentPoints, referencePoints, Calib3d.RANSAC, 2.5, inliers, 800, 0.995)
      if (homography.empty()) return null
      val selected = good.indices.filter { inliers.get(it, 0)[0] != 0.0 }
      if (selected.size < 18 || selected.size < good.size * 0.4) return null
      val matchedPoints = selected.map { points[good[it].queryIdx].pt }
      if ((matchedPoints.maxOf { it.x } - matchedPoints.minOf { it.x }) < intrinsics[2] * 0.3 ||
        (matchedPoints.maxOf { it.y } - matchedPoints.minOf { it.y }) < intrinsics[5] * 0.3) return null
      fun ray(point: Point, camera: DoubleArray): DoubleArray {
        val x = (point.x - camera[2]) / camera[0]; val y = (point.y - camera[5]) / camera[4]
        val length = sqrt(x * x + y * y + 1)
        return doubleArrayOf(x / length, y / length, 1 / length)
      }
      val covariance = DoubleArray(9)
      for (index in selected) {
        val current = ray(points[good[index].queryIdx].pt, intrinsics)
        val target = ray(reference.points[good[index].trainIdx].pt, reference.intrinsics)
        for (row in 0..2) for (column in 0..2) covariance[row * 3 + column] += target[row] * current[column]
      }
      val covarianceMatrix = CaptureBasis.matrix(covariance)
      val singular = Mat(); val left = Mat(); val right = Mat(); val rotation = Mat(); val empty = Mat()
      try {
        Core.SVDecomp(covarianceMatrix, singular, left, right)
        Core.gemm(left, right, 1.0, empty, 0.0, rotation)
        if (Core.determinant(rotation) < 0) {
          for (row in 0..2) left.put(row, 2, -left.get(row, 2)[0])
          Core.gemm(left, right, 1.0, empty, 0.0, rotation)
        }
        val relative = DoubleArray(9); rotation.get(0, 0, relative)
        var errorPixels = 0.0
        for (index in selected) {
          val current = ray(points[good[index].queryIdx].pt, intrinsics)
          val transformed = DoubleArray(3) { row -> (0..2).sumOf { relative[row * 3 + it] * current[it] } }
          if (transformed[2] <= 0) return null
          val target = reference.points[good[index].trainIdx].pt
          errorPixels += hypot(transformed[0] / transformed[2] * reference.intrinsics[0] + reference.intrinsics[2] - target.x,
            transformed[1] / transformed[2] * reference.intrinsics[4] + reference.intrinsics[5] - target.y)
        }
        if (errorPixels / selected.size > 3.0) return null
        return Pair(CaptureBasis.multiply(reference.basis, relative), selected.size)
      } finally {
        covarianceMatrix.release(); singular.release(); left.release(); right.release(); rotation.release(); empty.release()
      }
    } finally {
      matches.forEach { it.release() }; currentPoints.release(); referencePoints.release(); inliers.release(); homography?.release()
    }
  }

  override fun close() {
    references.forEach { it.close() }; references.clear(); orb.clear(); matcher.clear()
  }
}
