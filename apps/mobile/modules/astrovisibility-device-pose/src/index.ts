import { requireNativeModule } from 'expo-modules-core';

export type NativePoseVector = Readonly<{
  east: number;
  north: number;
  up: number;
}>;

export type NativeDevicePose = Readonly<{
  accuracy: number;
  forward: NativePoseVector;
  right: NativePoseVector;
  timestampNanoseconds: number;
  up: NativePoseVector;
}>;

export type RearCameraFieldOfView = Readonly<{
  approximate: boolean;
  horizontalDegrees: number;
  verticalDegrees: number;
}>;

type PoseSubscription = Readonly<{ remove(): void }>;

export type AstrovisibilityDevicePoseModule = Readonly<{
  addListener(
    eventName: 'onPoseChanged',
    listener: (event: NativeDevicePose) => void,
  ): PoseSubscription;
  configureObserverAsync(
    latitudeDegreesNorth: number,
    longitudeDegreesEast: number,
    elevationMetersAboveMeanSeaLevel: number,
    timestampMillisecondsUtc: number,
  ): Promise<void>;
  getRearCameraFieldOfViewAsync(): Promise<RearCameraFieldOfView>;
  isAvailableAsync(): Promise<boolean>;
}>;

export default requireNativeModule<AstrovisibilityDevicePoseModule>(
  'AstrovisibilityDevicePose',
);
