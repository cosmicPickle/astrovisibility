#include "Panorama.hpp"
#include <opencv2/features2d.hpp>
#include <opencv2/stitching/detail/matchers.hpp>
#include <opencv2/stitching/detail/motion_estimators.hpp>
#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>

namespace panorama {
Tile cameraPlacement(const Camera& camera) {
  const auto forward = camera.worldFromCamera * cv::Vec3d(0, 0, 1);
  const auto imageRight = camera.worldFromCamera * cv::Vec3d(1, 0, 0);
  const double azimuth = std::atan2(forward[0], forward[2]);
  const double altitude = std::atan2(forward[1], std::hypot(forward[0], forward[2]));
  const cv::Vec3d right(std::cos(azimuth), 0, -std::sin(azimuth));
  const cv::Vec3d up(-std::sin(altitude) * std::sin(azimuth), std::cos(altitude),
                    -std::sin(altitude) * std::cos(azimuth));
  return {"", std::fmod(azimuth * 180 / CV_PI + 360, 360), altitude * 180 / CV_PI,
          std::atan2(imageRight.dot(up), imageRight.dot(right)) * 180 / CV_PI,
          2 * std::atan(.5 / camera.focalXFraction) * 180 / CV_PI,
          2 * std::atan(.5 / camera.focalYFraction) * 180 / CV_PI};
}

Camera measuredCamera(const Tile& tile) {
  const double azimuth = tile.azimuthDegrees * CV_PI / 180;
  const double altitude = tile.altitudeDegrees * CV_PI / 180;
  const double roll = tile.rollDegrees * CV_PI / 180;
  const cv::Vec3d forward(std::cos(altitude) * std::sin(azimuth), std::sin(altitude),
                          std::cos(altitude) * std::cos(azimuth));
  const cv::Vec3d right(std::cos(azimuth), 0, -std::sin(azimuth));
  const cv::Vec3d up(-std::sin(altitude) * std::sin(azimuth), std::cos(altitude),
                    -std::sin(altitude) * std::cos(azimuth));
  const auto rolledRight = right * std::cos(roll) + up * std::sin(roll);
  const auto down = right * std::sin(roll) - up * std::cos(roll);
  return {cv::Matx33d(rolledRight[0], down[0], forward[0],
                      rolledRight[1], down[1], forward[1],
                      rolledRight[2], down[2], forward[2]),
          .5 / std::tan(tile.horizontalFovDegrees * CV_PI / 360),
          .5 / std::tan(tile.verticalFovDegrees * CV_PI / 360), .5, .5};
}

static cv::UMat candidatePairs(const std::vector<Tile>& tiles,
                              const std::vector<Camera>& cameras) {
  const int count = static_cast<int>(tiles.size());
  cv::Mat mask = cv::Mat::zeros(count, count, CV_8U);
  for (int source = 0; source < count; ++source) {
    std::vector<std::pair<double, int>> neighbors;
    const auto forward = cameras[source].worldFromCamera * cv::Vec3d(0, 0, 1);
    for (int target = 0; target < count; ++target) {
      if (source == target) continue;
      // Small captures can afford all pairs. In longer captures, chronological
      // neighbours bridge clusters of heavily overlapping shots even when all
      // six nearest sensor poses belong to the same cluster.
      if (count <= 12 || std::abs(source - target) <= 2)
        mask.at<uchar>(source, target) = 1;
      const auto other = cameras[target].worldFromCamera * cv::Vec3d(0, 0, 1);
      const double distance = std::acos(std::clamp(forward.dot(other), -1.0, 1.0)) * 180 / CV_PI;
      // Sensor error allowance plus both frame diagonals. Sensor poses choose
      // candidates only; OpenCV features determine the actual registration.
      const double overlapLimit = 20 + .5 * (std::hypot(tiles[source].horizontalFovDegrees,
          tiles[source].verticalFovDegrees) + std::hypot(tiles[target].horizontalFovDegrees,
          tiles[target].verticalFovDegrees));
      if (distance < overlapLimit) neighbors.emplace_back(distance, target);
    }
    std::sort(neighbors.begin(), neighbors.end());
    for (size_t index = 0; index < std::min<size_t>(6, neighbors.size()); ++index) {
      const int target = neighbors[index].second;
      mask.at<uchar>(source, target) = mask.at<uchar>(target, source) = 1;
    }
  }
  cv::UMat result;
  mask.copyTo(result);
  return result;
}

static bool solveGroup(const std::vector<int>& group,
                       const std::vector<cv::detail::ImageFeatures>& allFeatures,
                       const std::vector<cv::detail::MatchesInfo>& allMatches,
                       std::vector<Camera>& cameras, const CheckCancelled& checkCancelled) {
  const int count = static_cast<int>(group.size());
  std::vector<cv::detail::ImageFeatures> features;
  std::vector<cv::detail::MatchesInfo> matches(count * count);
  for (int index = 0; index < count; ++index) {
    features.push_back(allFeatures[group[index]]);
    features.back().img_idx = index;
    for (int target = 0; target < count; ++target) {
      auto& match = matches[index * count + target];
      match = allMatches[group[index] * allFeatures.size() + group[target]];
      match.src_img_idx = index;
      match.dst_img_idx = target;
    }
  }
  try {
    // Near-identical photos cannot determine focal length from their motion.
    // Initialize with the captured lens FOV; bundle adjustment can still refine
    // focal length when the matched rotations provide enough information.
    std::vector<cv::detail::CameraParams> recovered(count);
    for (int index = 0; index < count; ++index) {
      const auto& measured = cameras[group[index]];
      const auto size = features[index].img_size;
      recovered[index].focal = measured.focalXFraction * size.width;
      recovered[index].aspect = measured.focalYFraction * size.height / recovered[index].focal;
      recovered[index].ppx = .5 * size.width;
      recovered[index].ppy = .5 * size.height;
    }
    cv::detail::HomographyBasedEstimator estimator(true);
    if (!estimator(features, matches, recovered)) return false;
    for (auto& camera : recovered) camera.R.convertTo(camera.R, CV_32F);
    checkCancelled();
    cv::detail::BundleAdjusterRay adjuster;
    adjuster.setConfThresh(1.0);
    adjuster.setTermCriteria({cv::TermCriteria::COUNT | cv::TermCriteria::EPS, 30, 1e-6});
    if (!adjuster(features, matches, recovered)) return false;
    checkCancelled();
    cv::Mat rotation;
    recovered.front().R.convertTo(rotation, CV_64F);
    const cv::Matx33d worldFromEstimate = cameras[group.front()].worldFromCamera * cv::Matx33d(rotation).t();
    std::vector<Camera> solved;
    for (int index = 0; index < count; ++index) {
      const auto& camera = recovered[index];
      const auto size = features[index].img_size;
      camera.R.convertTo(rotation, CV_64F);
      if (!cv::checkRange(rotation) || !std::isfinite(camera.focal) ||
          camera.focal < size.width * .1 || camera.focal > size.width * 10 ||
          !std::isfinite(camera.aspect) || camera.aspect <= 0 ||
          !std::isfinite(camera.ppx) || !std::isfinite(camera.ppy)) return false;
      solved.push_back({worldFromEstimate * cv::Matx33d(rotation),
                        camera.focal / size.width, camera.focal * camera.aspect / size.height,
                        camera.ppx / size.width, camera.ppy / size.height});
    }
    for (int index = 0; index < count; ++index) cameras[group[index]] = solved[index];
    return true;
  } catch (const cv::Exception&) {
    return false;
  }
}

Registration registerCameras(const std::vector<Tile>& tiles, const Progress& progress,
                             const CheckCancelled& checkCancelled) {
  if (tiles.empty() || tiles.size() > 200) throw std::runtime_error("Invalid photo count");
  Registration result;
  for (const auto& tile : tiles) result.cameras.push_back(measuredCamera(tile));
  checkCancelled();
  if (tiles.size() == 1) return result;
  cv::setNumThreads(2);
  std::vector<cv::detail::ImageFeatures> features(tiles.size());
  const auto detector = cv::ORB::create(1600);
  for (size_t index = 0; index < tiles.size(); ++index) {
    checkCancelled();
    progress("matching", static_cast<int>(index), static_cast<int>(tiles.size()));
    const auto image = readImage(tiles[index].path, 640);
    cv::detail::computeImageFeatures(detector, image, features[index]);
    features[index].img_idx = static_cast<int>(index);
  }
  checkCancelled();
  progress("aligning", 0, 1);
  std::vector<cv::detail::MatchesInfo> matches;
  // Default confidence >3 rejection drops near-duplicate captures. Keep their
  // RANSAC-verified matches: every supplied tile still participates in blending.
  cv::detail::BestOf2NearestMatcher matcher(false, .3f, 6, 6, 4.0);
  matcher(features, matches, candidatePairs(tiles, result.cameras));
  matcher.collectGarbage();
  const int count = static_cast<int>(tiles.size());
  std::vector<bool> visited(count, false);
  for (int start = 0; start < count; ++start) {
    if (visited[start]) continue;
    checkCancelled();
    std::vector<int> group{start};
    visited[start] = true;
    for (size_t next = 0; next < group.size(); ++next) {
      for (int target = 0; target < count; ++target) {
        if (!visited[target] && matches[group[next] * count + target].confidence >= 1.0) {
          visited[target] = true;
          group.push_back(target);
        }
      }
    }
    std::sort(group.begin(), group.end());
    const bool solved = group.size() >= 2 && solveGroup(group, features, matches, result.cameras, checkCancelled);
    // Independently solved islands still rely on sensors for their placement
    // relative to the first capture. Disclose those joins in the preview too.
    if (!solved || start != 0)
      result.unmatchedCount += static_cast<int>(group.size());
  }
  return result;
}
}
