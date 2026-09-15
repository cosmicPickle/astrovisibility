#include "Panorama.hpp"
#include <jni.h>
#include <atomic>
#include <mutex>
#include <stdexcept>

namespace {
std::mutex jobMutex;
std::string activeJob;
std::atomic<bool> cancelled{false};

std::string stringValue(JNIEnv* env, jstring value) {
  const char* bytes = env->GetStringUTFChars(value, nullptr);
  if (!bytes) throw std::runtime_error("Unavailable string");
  std::string result(bytes);
  env->ReleaseStringUTFChars(value, bytes);
  return result;
}
}

extern "C" JNIEXPORT void JNICALL
Java_com_cosmicpickle_astrovisibility_panorama_AstrovisibilityPanoramaModule_cancelNative(
    JNIEnv* env, jobject, jstring job) {
  std::lock_guard<std::mutex> lock(jobMutex);
  if (activeJob == stringValue(env, job)) cancelled.store(true);
}

extern "C" JNIEXPORT jdoubleArray JNICALL
Java_com_cosmicpickle_astrovisibility_panorama_AstrovisibilityPanoramaModule_stitchNative(
    JNIEnv* env, jobject module, jstring job, jobjectArray paths, jdoubleArray placements, jstring prefix,
    jboolean useReviewedPlacements) {
  try {
    const auto jobId = stringValue(env, job);
    {
      std::lock_guard<std::mutex> lock(jobMutex);
      if (!activeJob.empty()) throw std::runtime_error("Busy");
      activeJob = jobId;
      cancelled.store(false);
    }
    struct ClearJob {
      ~ClearJob() { std::lock_guard<std::mutex> lock(jobMutex); activeJob.clear(); }
    } clearJob;
    const auto count = env->GetArrayLength(paths);
    if (count < 1 || count > 200 || env->GetArrayLength(placements) != count * 5)
      throw std::runtime_error("Invalid inputs");
    std::vector<double> values(count * 5);
    env->GetDoubleArrayRegion(placements, 0, count * 5, values.data());
    std::vector<panorama::Tile> tiles;
    for (int index = 0; index < count; ++index) {
      auto path = static_cast<jstring>(env->GetObjectArrayElement(paths, index));
      const int offset = index * 5;
      tiles.push_back({stringValue(env, path), values[offset], values[offset + 1], values[offset + 2],
                       values[offset + 3], values[offset + 4]});
      env->DeleteLocalRef(path);
    }
    const auto clazz = env->GetObjectClass(module);
    const auto callback = env->GetMethodID(clazz, "reportProgress", "(Ljava/lang/String;Ljava/lang/String;II)V");
    const auto isCancelled = env->GetMethodID(clazz, "isJobCancelled", "(Ljava/lang/String;)Z");
    if (!callback || !isCancelled) throw std::runtime_error("Unavailable callback");
    const panorama::CheckCancelled check = [&] {
      if (cancelled.load() || env->CallBooleanMethod(module, isCancelled, job))
        throw std::runtime_error("Cancelled");
    };
    const panorama::Progress progress = [&](const char* stage, int completed, int total) {
      check();
      const auto label = env->NewStringUTF(stage);
      env->CallVoidMethod(module, callback, job, label, completed, total);
      env->DeleteLocalRef(label);
      if (env->ExceptionCheck()) throw std::runtime_error("Unavailable progress");
    };
    panorama::Registration registration;
    if (useReviewedPlacements) {
      for (const auto& tile : tiles) registration.cameras.push_back(panorama::measuredCamera(tile));
    } else registration = panorama::registerCameras(tiles, progress, check);
    panorama::compose(tiles, registration.cameras, stringValue(env, prefix), progress, check);
    std::vector<double> result{static_cast<double>(registration.unmatchedCount)};
    for (const auto& camera : registration.cameras) {
      const auto placement = panorama::cameraPlacement(camera);
      result.insert(result.end(), {placement.azimuthDegrees, placement.altitudeDegrees,
        placement.rollDegrees, placement.horizontalFovDegrees, placement.verticalFovDegrees});
    }
    const auto output = env->NewDoubleArray(static_cast<jsize>(result.size()));
    if (!output) throw std::runtime_error("Unavailable result");
    env->SetDoubleArrayRegion(output, 0, static_cast<jsize>(result.size()), result.data());
    return output;
  } catch (...) {
    // Never propagate OpenCV exceptions containing private paths or payloads.
    if (env->ExceptionCheck()) env->ExceptionClear();
    env->ThrowNew(env->FindClass("java/lang/RuntimeException"), "Panorama processing failed");
    return nullptr;
  }
}
