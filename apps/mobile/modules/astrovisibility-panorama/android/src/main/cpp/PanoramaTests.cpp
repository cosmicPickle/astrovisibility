#include "Panorama.hpp"
#include <cmath>
#include <fstream>
#include <iostream>
#include <stdexcept>

using namespace panorama;
void check(bool condition, const char* message) {
  if (!condition) throw std::runtime_error(message);
}

int main(int argc, char** argv) {
  try {
    check(argc == 2, "Supply the synthetic fixture directory");
    const std::string root = argv[1];
    const Progress progress = [](const char*, int, int) {};
    const CheckCancelled running = [] {};
    std::vector<Tile> duplicates = {
      {root + "/synthetic-1.png", 0, 65, 0, 75, 59.840444},
      {root + "/synthetic-1.png", 20, 55, 12, 75, 59.840444},
      {root + "/synthetic-1.png", 355, 70, -8, 75, 59.840444}
    };
    const auto duplicateResult = registerCameras(duplicates, progress, running);
    check(duplicateResult.unmatchedCount == 0, "Strong near-duplicate matches must not be discarded");
    check(std::abs(cameraPlacement(duplicateResult.cameras[0]).horizontalFovDegrees - 75) < .1,
          "Duplicate photos must not invent a narrower lens FOV");
    for (const auto& camera : duplicateResult.cameras)
      check(cv::norm(cv::Mat(camera.worldFromCamera - duplicateResult.cameras[0].worldFromCamera)) < .01,
            "Duplicate photos retained incorrect sensor positions");
    auto north = measuredCamera({"", 0, 0, 0, 60, 45});
    check(cv::norm(north.worldFromCamera * cv::Vec3d(0, 0, 1) - cv::Vec3d(0, 0, 1)) < 1e-8, "North reference");
    auto zenith = measuredCamera({"", 359, 90, 12, 60, 45});
    check(cv::norm(zenith.worldFromCamera * cv::Vec3d(0, 0, 1) - cv::Vec3d(0, 1, 0)) < 1e-8, "Zenith reference");
    check(std::abs(north.focalXFraction - north.focalYFraction) > .1, "Independent horizontal and vertical FOV");
    for (double altitude : {-3.0, 0.0, 65.0, 90.0}) for (double roll : {-180.0, 12.0, 179.0}) {
      const auto expected = measuredCamera({"", 359, altitude, roll, 75, 59.840444});
      const auto roundTrip = measuredCamera(cameraPlacement(expected));
      check(cv::norm(cv::Mat(roundTrip.worldFromCamera - expected.worldFromCamera)) < 1e-8,
            "Recovered pose lost roll, zenith or north-wrap alignment");
      check(std::abs(roundTrip.focalXFraction - expected.focalXFraction) < 1e-8 &&
            std::abs(roundTrip.focalYFraction - expected.focalYFraction) < 1e-8,
            "Recovered pose lost intrinsics");
    }
    std::vector<Tile> tiles = {
      {root + "/synthetic-1.png", 0, 65, 0, 75, 59.840444},
      {root + "/synthetic-2.png", 40, 80, 8, 75, 59.840444},
      {root + "/synthetic-3.png", 85, 65, -6, 75, 59.840444}
    };
    auto result = registerCameras(tiles, progress, running);
    check(result.unmatchedCount == 0, "All upward photos must match");
    for (size_t i = 0; i < tiles.size(); ++i) {
      const auto expected = measuredCamera(tiles[i]).worldFromCamera;
      const auto actual = result.cameras[i].worldFromCamera;
      const double cosine = std::clamp((cv::trace(expected.t() * actual) - 1) / 2, -1.0, 1.0);
      check(std::acos(cosine) * 180 / CV_PI < 1.0, "Recovered upward rotation exceeds one degree");
    }
    compose(tiles, result.cameras, root + "/upward", progress, running);
    auto inaccurate = tiles;
    inaccurate[1].azimuthDegrees += 25;
    inaccurate[1].altitudeDegrees -= 15;
    inaccurate[2].rollDegrees += 20;
    const auto corrected = registerCameras(inaccurate, progress, running);
    check(corrected.unmatchedCount == 0, "Multiple overlapping photos with inaccurate sensors must match");
    for (size_t index = 0; index < tiles.size(); ++index)
      check(cv::norm(cv::Mat(corrected.cameras[index].worldFromCamera - result.cameras[index].worldFromCamera)) < .01,
            "Registration remains constrained to inaccurate sensor positions");
    auto image = cv::imread(root + "/upward.png", cv::IMREAD_UNCHANGED);
    std::vector<Camera> reviewed;
    for (const auto& camera : result.cameras) {
      reviewed.push_back(measuredCamera(cameraPlacement(camera)));
      check(cv::norm(cv::Mat(reviewed.back().worldFromCamera - camera.worldFromCamera)) < 1e-6,
            "Manual entry changed recovered camera geometry");
    }
    compose(tiles, reviewed, root + "/reviewed", progress, running);
    const auto recomposed = cv::imread(root + "/reviewed.png", cv::IMREAD_UNCHANGED);
    // OpenCV's float rotations and quantized interpolation can change a few
    // colour values at sampling-bin boundaries. Coverage and geometry stay fixed.
    check(cv::norm(image, recomposed, cv::NORM_L1) / (image.total() * 4) < .001 &&
          cv::norm(image, recomposed, cv::NORM_INF) <= 8,
          "Manual entry without edits changed the stitched image");
    for (int row = 0; row < image.rows; ++row) for (int col = 0; col < image.cols; ++col)
      check(image.at<cv::Vec4b>(row, col)[3] == recomposed.at<cv::Vec4b>(row, col)[3],
            "Manual entry changed panorama coverage");
    check(image.size() == cv::Size(2048, 2048) && image.channels() == 4, "Single RGBA atlas");
    check(image.at<cv::Vec4b>(1024, 1024)[3] == 255, "Zenith remains covered");
    check(image.at<cv::Vec4b>(0, 0)[3] == 0, "Outside hemisphere is transparent");
    std::ifstream bits(root + "/upward.coverage", std::ios::binary | std::ios::ate);
    check(bits.tellg() == 2048 * 2048 / 8, "Persisted coverage size");
    cv::Mat black(240, 320, CV_8UC3, cv::Scalar::all(0));
    cv::imwrite(root + "/black.png", black);
    std::vector<Tile> blank = {{root + "/black.png", 359, 90, 0, 60, 45}};
    auto single = registerCameras(blank, progress, running);
    check(single.unmatchedCount == 0, "One image requires no matching");
    compose(blank, single.cameras, root + "/black-atlas", progress, running);
    image = cv::imread(root + "/black-atlas.png", cv::IMREAD_UNCHANGED);
    check(image.at<cv::Vec4b>(1024, 1024) == cv::Vec4b(0, 0, 0, 255), "Black pixels are covered, not holes");
    blank.resize(200, blank[0]);
    check(registerCameras(blank, progress, running).unmatchedCount == 200, "Unmatchable photos are retained");
    bool cancelled = false;
    try { registerCameras(tiles, progress, [] { throw std::runtime_error("cancelled"); }); }
    catch (...) { cancelled = true; }
    check(cancelled, "Cancellation interrupts processing");
    std::cout << "Panorama native tests passed\n";
    return 0;
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
