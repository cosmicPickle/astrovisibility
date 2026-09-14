#pragma once

#include <opencv2/core.hpp>
#include <opencv2/imgcodecs.hpp>
#include <functional>
#include <string>
#include <vector>

namespace panorama {
constexpr int atlasSize = 2048;
struct Tile {
  std::string path;
  double azimuthDegrees, altitudeDegrees, rollDegrees;
  double horizontalFovDegrees, verticalFovDegrees;
};
struct Camera {
  // World east/up/north; camera image-right/image-down/forward.
  cv::Matx33d worldFromCamera;
  double focalXFraction, focalYFraction, centerXFraction, centerYFraction;
};
struct Registration {
  std::vector<Camera> cameras;
  int unmatchedCount = 0;
};
using Progress = std::function<void(const char*, int, int)>;
using CheckCancelled = std::function<void()>;
Camera measuredCamera(const Tile& tile);
cv::Mat readImage(const std::string& path, int longestEdge);
Registration registerCameras(const std::vector<Tile>& tiles, const Progress& progress,
                             const CheckCancelled& checkCancelled);
void compose(const std::vector<Tile>& tiles, const std::vector<Camera>& cameras,
             const std::string& outputPrefix, const Progress& progress,
             const CheckCancelled& checkCancelled);
}
