package com.cosmicpickle.astrovisibility.panorama

import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import kotlin.math.abs

internal fun checkContinuousCapture(context: android.content.Context) {
  val seedFile = java.io.File(context.cacheDir, "continuous-seed-test.jpg")
  val seedBitmap = android.graphics.Bitmap.createBitmap(960, 1280, android.graphics.Bitmap.Config.ARGB_8888)
  try {
    seedFile.outputStream().use { check(seedBitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, it)) }
    val decoded = readCaptureSeed(context, seedFile.toURI().toString())
    try { check(decoded.cols() == 480 && decoded.rows() == 640) { "Draft seed sampling lost dimensions" } }
    finally { decoded.release() }
  } finally { seedBitmap.recycle(); seedFile.delete() }
  val previewCorners = floatArrayOf(0f, 0f, 390f, 0f, 390f, 300f, 0f, 300f)
  capturePreviewTransform(390f, 300f, android.util.Size(1280, 960)).mapPoints(previewCorners)
  check(abs(previewCorners[1] - previewCorners[3]) < 0.01 && previewCorners[0] < previewCorners[2]) {
    "Preview rotated an already sensor-oriented TextureView"
  }
  check(abs((previewCorners[2] - previewCorners[0]) / (previewCorners[5] - previewCorners[3]) - 0.75) < 0.001)
  val tracker = ContinuousTracker()
  val image = Mat(480, 360, CvType.CV_8UC1, Scalar(90.0))
  val random = java.util.Random(431)
  repeat(350) {
    Imgproc.circle(image, Point(random.nextInt(360).toDouble(), random.nextInt(480).toDouble()),
      2 + random.nextInt(6), Scalar(random.nextInt(255).toDouble()), -1)
  }
  val north = CaptureBasis.fromPlacement(359.0, 45.0, 0.0)
  val first = tracker.analyze(image, north, 55.0, 69.0)
  check(first.status == "tracking" && first.accept) { "First textured frame rejected" }
  tracker.retain(first)
  // Identical imagery with a deliberately wrong sensor heading must relocalize
  // to the map, not trust the sensor or add duplicate captures.
  val revisit = tracker.analyze(image, CaptureBasis.fromPlacement(8.0, 45.0, 0.0), 55.0, 69.0)
  check(revisit.status == "tracking" && !revisit.accept)
  check(CaptureBasis.angleDegrees(revisit.basis, north) < 0.5) { "Visual correction ignored" }
  revisit.close()
  val blank = Mat.zeros(480, 360, CvType.CV_8UC1)
  val lost = tracker.analyze(blank, north, 55.0, 69.0)
  check(!lost.accept && lost.status != "tracking") { "Featureless frame entered panorama" }
  lost.close()
  // A perspective warp of a calibrated image represents an actual rotation.
  val rotated = Mat()
  val turn = CaptureBasis.fromPlacement(359.0, 45.0, 18.0)
  val homography = CaptureBasis.imageHomography(north, turn, 360, 480, 55.0, 69.0)
  Imgproc.warpPerspective(image, rotated, homography, image.size())
  val tracked = tracker.analyze(rotated, north, 55.0, 69.0)
  check(tracked.status == "tracking") { "Rotated image failed tracking" }
  check(CaptureBasis.angleDegrees(tracked.basis, turn) < 1.5) { "Image rotation fit inaccurate" }
  tracked.close()
  for (placement in listOf(doubleArrayOf(15.0, 45.0, 0.0), doubleArrayOf(15.0, 59.0, 5.0),
    doubleArrayOf(359.0, 45.0, 0.0))) {
    val direction = CaptureBasis.fromPlacement(placement[0], placement[1], placement[2])
    val warp = CaptureBasis.imageHomography(north, direction, 360, 480, 55.0, 69.0)
    try {
      Imgproc.warpPerspective(image, rotated, warp, image.size())
      val moved = tracker.analyze(rotated, direction, 55.0, 69.0)
      check(moved.status == "tracking") { "Two-axis sweep lost tracking" }
      check(CaptureBasis.angleDegrees(moved.basis, direction) < 1.5) { "Two-axis rotation inaccurate" }
      if (moved.accept) tracker.retain(moved) else moved.close()
    } finally { warp.release() }
  }
  for (altitude in listOf(0.0, 45.0, 89.9, 90.0)) {
    val basis = CaptureBasis.fromPlacement(359.0, altitude, 25.0)
    val placement = CaptureBasis.placement(basis)
    val reconstructed = CaptureBasis.fromPlacement(placement[0], placement[1], placement[2])
    check(CaptureBasis.angleDegrees(basis, reconstructed) < 0.001)
    check(abs(placement[1] - altitude) < 0.001)
  }
  while (tracker.size < 96) tracker.seed(image, north, 55.0, 69.0)
  val full = tracker.analyze(image, north, 55.0, 69.0)
  check(full.status == "capacity" && !full.accept && tracker.size == 96)
  full.close()
  homography.release(); rotated.release(); blank.release(); image.release(); tracker.close()
}
