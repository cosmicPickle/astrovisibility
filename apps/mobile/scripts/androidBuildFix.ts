const expoRootPlugin = 'apply plugin: "expo-root-project"';
const workaround = `// Rallypath's proven Windows native-build workaround. The Android SDK's bundled
// Ninja repeatedly regenerates build.ninja when pnpm-backed Worklets paths cross
// CMake's conservative object-path limit.
def cmakeLongPathArguments = [
  "-DCMAKE_MAKE_PROGRAM=C:\\\\ninja\\\\ninja.exe",
  "-DCMAKE_OBJECT_PATH_MAX=1024"
]

subprojects { subproject ->
  ["com.android.application", "com.android.library"].each { pluginId ->
    subproject.plugins.withId(pluginId) {
      subproject.android {
        defaultConfig {
          externalNativeBuild {
            cmake {
              arguments(*cmakeLongPathArguments)
            }
          }
        }
      }
    }
  }
}

`;

export function applyAndroidBuildFix(buildGradle: string): string {
  if (!buildGradle.includes(expoRootPlugin)) {
    throw new Error('Expo Android project build.gradle anchor not found.');
  }
  let result = buildGradle;
  if (!result.includes('def cmakeLongPathArguments'))
    result = result.replace(expoRootPlugin, `${workaround}${expoRootPlugin}`);
  if (!result.includes('// OpenCV shared C++ runtime'))
    result = result.replace(
      expoRootPlugin,
      `${sharedRuntime}${expoRootPlugin}`,
    );
  return result;
}

const sharedRuntime = `// OpenCV shared C++ runtime: RN, OpenCV and the NDK export the same ABI.
// Configure before app evaluation, and keep one copy in the final APK.
subprojects { subproject ->
  subproject.plugins.withId("com.android.application") {
    subproject.android.packagingOptions.jniLibs.pickFirsts += ["**/libc++_shared.so"]
  }
}

`;
