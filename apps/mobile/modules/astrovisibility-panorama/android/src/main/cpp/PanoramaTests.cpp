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
    auto north = measuredCamera({"", 0, 0, 0, 60, 45});
    check(cv::norm(north.worldFromCamera * cv::Vec3d(0, 0, 1) - cv::Vec3d(0, 0, 1)) < 1e-8, "North reference");
    auto zenith = measuredCamera({"", 359, 90, 12, 60, 45});
    check(cv::norm(zenith.worldFromCamera * cv::Vec3d(0, 0, 1) - cv::Vec3d(0, 1, 0)) < 1e-8, "Zenith reference");
    check(std::abs(north.focalXFraction - north.focalYFraction) > .1, "Independent horizontal and vertical FOV");
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
    auto image = cv::imread(root + "/upward.png", cv::IMREAD_UNCHANGED);
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
