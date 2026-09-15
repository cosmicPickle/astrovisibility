import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';
import type { DevicePoseSample } from './devicePose';

export interface ContinuousFrame {
  sequence: number;
  uri: string;
  widthPixels: number;
  heightPixels: number;
  horizontalDegrees: number;
  verticalDegrees: number;
  pose: DevicePoseSample;
  sensorPose: DevicePoseSample;
}
export interface ContinuousTracking {
  status: string;
  pose?: DevicePoseSample;
  sensorPose?: DevicePoseSample;
  horizontalDegrees?: number;
  verticalDegrees?: number;
}
interface NativeContinuousCameraProps extends ViewProps {
  recording: boolean;
  acknowledgement: number;
  initialTiles: string;
  observer: {
    latitudeDegreesNorth: number;
    longitudeDegreesEast: number;
    elevationMetersAboveMeanSeaLevel: number;
  };
  onFrame(event: { nativeEvent: ContinuousFrame }): void;
  onTracking(event: { nativeEvent: ContinuousTracking }): void;
  onStopped(): void;
  onInterruption(): void;
}
export const NativeContinuousCamera =
  requireNativeView<NativeContinuousCameraProps>('AstrovisibilityPanorama');
