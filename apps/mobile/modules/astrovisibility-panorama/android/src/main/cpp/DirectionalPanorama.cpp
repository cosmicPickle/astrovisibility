#include "Panorama.hpp"
#include <opencv2/imgproc.hpp>
#include <opencv2/stitching/detail/blenders.hpp>
#include <opencv2/stitching/detail/exposure_compensate.hpp>
#include <opencv2/stitching/detail/seam_finders.hpp>
#include <algorithm>
#include <cmath>
#include <fstream>
#include <stdexcept>

namespace panorama {
cv::Mat readImage(const std::string& path, int longestEdge) {
  // The Android boundary validates dimensions and creates sampled, upright
  // images. imdecode avoids leaking private source paths through codec logs.
  std::ifstream file(path, std::ios::binary | std::ios::ate);
  const auto length = file.tellg();
  if (length <= 0 || length > 32 * 1024 * 1024) throw std::runtime_error("Invalid image");
  std::vector<uchar> bytes(static_cast<size_t>(length));
  file.seekg(0);
  if (!file.read(reinterpret_cast<char*>(bytes.data()), length)) throw std::runtime_error("Unreadable image");
  auto image = cv::imdecode(bytes, cv::IMREAD_COLOR);
  if (image.empty() || image.cols > 12000 || image.rows > 12000 || image.total() > 40000000)
    throw std::runtime_error("Invalid image dimensions");
  const double scale = std::min(1.0, static_cast<double>(longestEdge) / std::max(image.cols, image.rows));
  if (scale < 1) cv::resize(image, image, {}, scale, scale, cv::INTER_AREA);
  return image;
}

static cv::Mat atlasRays(int size) {
  cv::Mat rays(size, size, CV_32FC3);
  const double half = size / 2.0;
  for (int row = 0; row < size; ++row) {
    auto* output = rays.ptr<cv::Vec3f>(row);
    for (int column = 0; column < size; ++column) {
      const double east = (column - half) / half;
      const double north = (half - row) / half;
      const double radius = std::hypot(east, north);
      const double scale = radius > 0 ? std::sin(radius * CV_PI / 2) / radius : CV_PI / 2;
      output[column] = radius <= 1 ? cv::Vec3f(east * scale, std::cos(radius * CV_PI / 2), north * scale)
                                   : cv::Vec3f(0, -1, 0);
    }
  }
  return rays;
}

struct Patch {
  cv::Mat color, mask;
  cv::Rect bounds;
};

static Patch project(const cv::Mat& image, const Camera& camera, const cv::Mat& rays) {
  cv::Mat map(rays.size(), CV_32FC2, cv::Scalar(-1, -1));
  cv::Mat mask = cv::Mat::zeros(rays.size(), CV_8U);
  const cv::Matx33f cameraFromWorld = camera.worldFromCamera.t();
  const float focalX = camera.focalXFraction * image.cols;
  const float focalY = camera.focalYFraction * image.rows;
  const float centerX = camera.centerXFraction * image.cols;
  const float centerY = camera.centerYFraction * image.rows;
  for (int row = 0; row < rays.rows; ++row) {
    const auto* directions = rays.ptr<cv::Vec3f>(row);
    auto* coordinates = map.ptr<cv::Vec2f>(row);
    auto* coverage = mask.ptr<uchar>(row);
    for (int column = 0; column < rays.cols; ++column) {
      if (directions[column][1] < 0) continue;
      const auto ray = cameraFromWorld * directions[column];
      if (ray[2] <= 1e-6f) continue;
      const float sourceX = focalX * ray[0] / ray[2] + centerX;
      const float sourceY = focalY * ray[1] / ray[2] + centerY;
      if (sourceX < 0 || sourceX > image.cols - 1 || sourceY < 0 || sourceY > image.rows - 1) continue;
      coordinates[column] = {sourceX, sourceY};
      coverage[column] = 255;
    }
  }
  const auto bounds = cv::boundingRect(mask);
  if (bounds.empty()) throw std::runtime_error("Photo has no sky coverage");
  cv::Mat color;
  cv::remap(image, color, map(bounds), cv::noArray(), cv::INTER_LINEAR, cv::BORDER_CONSTANT);
  return {color, mask(bounds).clone(), bounds};
}

static void writeAtlas(const cv::Mat& color, const cv::Mat& coverage, const std::string& prefix) {
  cv::Mat rgba;
  cv::cvtColor(color, rgba, cv::COLOR_BGR2BGRA);
  cv::insertChannel(coverage, rgba, 3);
  rgba.setTo(cv::Scalar::all(0), coverage == 0);
  if (!cv::imwrite(prefix + ".png", rgba)) throw std::runtime_error("Cannot write panorama");
  std::vector<uchar> bits(atlasSize * atlasSize / 8, 0);
  for (int row = 0; row < atlasSize; ++row) {
    const auto* pixels = coverage.ptr<uchar>(row);
    for (int column = 0; column < atlasSize; ++column) {
      const int index = row * atlasSize + column;
      if (pixels[column]) bits[index >> 3] |= static_cast<uchar>(1 << (index & 7));
    }
  }
  std::ofstream file(prefix + ".coverage", std::ios::binary);
  file.write(reinterpret_cast<const char*>(bits.data()), bits.size());
  file.close();
  if (!file) throw std::runtime_error("Cannot write coverage");
}

void compose(const std::vector<Tile>& tiles, const std::vector<Camera>& cameras,
             const std::string& outputPrefix, const Progress& progress,
             const CheckCancelled& checkCancelled) {
  if (tiles.empty() || tiles.size() != cameras.size() || tiles.size() > 200)
    throw std::runtime_error("Invalid panorama inputs");
  constexpr int seamSize = 256;
  constexpr int seamScale = atlasSize / seamSize;
  std::vector<cv::UMat> colors, masks;
  std::vector<cv::Point> corners;
  auto rays = atlasRays(seamSize);
  for (size_t index = 0; index < tiles.size(); ++index) {
    checkCancelled();
    progress("seams", static_cast<int>(index), static_cast<int>(tiles.size()));
    const auto patch = project(readImage(tiles[index].path, 1024), cameras[index], rays);
    colors.emplace_back();
    masks.emplace_back();
    patch.color.copyTo(colors.back());
    patch.mask.copyTo(masks.back());
    corners.push_back(patch.bounds.tl());
  }
  auto compensator = cv::detail::ExposureCompensator::createDefault(cv::detail::ExposureCompensator::GAIN);
  compensator->feed(corners, colors, masks);
  checkCancelled();
  std::vector<cv::UMat> floats;
  for (size_t index = 0; index < colors.size(); ++index) {
    compensator->apply(static_cast<int>(index), corners[index], colors[index], masks[index]);
    floats.emplace_back();
    colors[index].convertTo(floats.back(), CV_32F);
  }
  colors.clear();
  cv::detail::GraphCutSeamFinder finder(cv::detail::GraphCutSeamFinderBase::COST_COLOR_GRAD);
  finder.find(floats, corners, masks);
  floats.clear();
  checkCancelled();
  rays = atlasRays(atlasSize);
  cv::Mat coverage = cv::Mat::zeros(atlasSize, atlasSize, CV_8U);
  cv::detail::MultiBandBlender blender(false, 6);
  blender.prepare(cv::Rect(0, 0, atlasSize, atlasSize));
  for (size_t index = 0; index < tiles.size(); ++index) {
    checkCancelled();
    progress("blending", static_cast<int>(index), static_cast<int>(tiles.size()));
    auto patch = project(readImage(tiles[index].path, 1024), cameras[index], rays);
    cv::bitwise_or(coverage(patch.bounds), patch.mask, coverage(patch.bounds));
    cv::Mat smallMask = cv::Mat::zeros(seamSize, seamSize, CV_8U);
    masks[index].copyTo(smallMask(cv::Rect(corners[index], masks[index].size())));
    cv::dilate(smallMask, smallMask, cv::Mat());
    cv::Mat seamMask;
    cv::resize(smallMask, seamMask, {atlasSize, atlasSize}, 0, 0, cv::INTER_NEAREST);
    cv::Mat blendMask;
    cv::bitwise_and(seamMask(patch.bounds), patch.mask, blendMask);
    compensator->apply(static_cast<int>(index), patch.bounds.tl() / seamScale, patch.color, patch.mask);
    cv::Mat signedColor;
    patch.color.convertTo(signedColor, CV_16S);
    blender.feed(signedColor, blendMask, patch.bounds.tl());
  }
  checkCancelled();
  cv::Mat blended, blendedMask, color;
  blender.blend(blended, blendedMask);
  blended.convertTo(color, CV_8U);
  blended.release();
  cv::Mat missing;
  cv::bitwise_and(coverage, ~blendedMask, missing);
  // A thin covered edge may vanish at seam resolution. Recover only those
  // pixels from a real covering source, never by extending/fabricating sky.
  for (size_t index = 0; index < tiles.size() && cv::countNonZero(missing); ++index) {
    checkCancelled();
    const auto patch = project(readImage(tiles[index].path, 1024), cameras[index], rays);
    cv::Mat restore;
    cv::bitwise_and(missing(patch.bounds), patch.mask, restore);
    compensator->apply(static_cast<int>(index), patch.bounds.tl() / seamScale, patch.color, patch.mask);
    patch.color.copyTo(color(patch.bounds), restore);
    missing(patch.bounds).setTo(0, restore);
  }
  if (cv::countNonZero(missing)) throw std::runtime_error("Incomplete coverage");
  checkCancelled();
  progress("writing", 0, 1);
  writeAtlas(color, coverage, outputPrefix);
  checkCancelled();
}
}
