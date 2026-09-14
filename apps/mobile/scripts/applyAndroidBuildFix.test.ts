/** @jest-environment node */

import { applyAndroidBuildFix } from './androidBuildFix';

describe('Android build fix regeneration', () => {
  it('preserves the OpenCV shared-runtime rule when the CMake fix already exists', () => {
    const result = applyAndroidBuildFix(
      'def cmakeLongPathArguments = []\napply plugin: "expo-root-project"\n',
    );
    expect(result).toContain('pickFirsts += ["**/libc++_shared.so"]');
    expect(applyAndroidBuildFix(result)).toBe(result);
  });
  it('inserts the Rallypath CMake arguments before Expo root plugins', () => {
    const result = applyAndroidBuildFix(
      'allprojects { repositories { google() } }\n\napply plugin: "expo-root-project"\n',
    );
    expect(result).toContain('-DCMAKE_MAKE_PROGRAM=C:\\\\ninja\\\\ninja.exe');
    expect(result).toContain('-DCMAKE_OBJECT_PATH_MAX=1024');
    expect(result.indexOf('cmakeLongPathArguments')).toBeLessThan(
      result.indexOf('apply plugin: "expo-root-project"'),
    );
  });

  it('is idempotent across repeated prebuild synchronization', () => {
    const source =
      'allprojects { repositories { google() } }\n\napply plugin: "expo-root-project"\n';
    const once = applyAndroidBuildFix(source);
    expect(applyAndroidBuildFix(once)).toBe(once);
  });
});
