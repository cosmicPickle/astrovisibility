import type { ConfigContext, ExpoConfig } from 'expo/config';

type AstrovisibilityExpoConfig = ExpoConfig & {
  newArchEnabled: boolean;
};

export default ({ config }: ConfigContext): AstrovisibilityExpoConfig => ({
  ...config,
  name: 'Astrovisibility',
  slug: 'astrovisibility',
  scheme: 'astrovisibility',
  version: '0.0.1',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  android: {
    allowBackup: false,
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.VIBRATE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    package: 'com.cosmicpickle.astrovisibility',
    versionCode: 1,
  },
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow Astrovisibility to capture your observing surroundings.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow Astrovisibility to save your observing position when you choose Use current location.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Astrovisibility to import surroundings for manual sky placement.',
      },
    ],
    [
      'expo-sensors',
      {
        motionPermission:
          'Allow Astrovisibility to orient captured sky tiles during panorama capture.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
