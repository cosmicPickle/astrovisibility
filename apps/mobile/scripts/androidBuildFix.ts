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
  if (buildGradle.includes('def cmakeLongPathArguments')) return buildGradle;
  if (!buildGradle.includes(expoRootPlugin)) {
    throw new Error('Expo Android project build.gradle anchor not found.');
  }
  return buildGradle.replace(expoRootPlugin, `${workaround}${expoRootPlugin}`);
}
