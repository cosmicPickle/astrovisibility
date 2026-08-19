import * as Location from 'expo-location';
import { Linking } from 'react-native';

export type CurrentProfileLocationResult =
  | {
      status: 'granted';
      latitudeDegreesNorth: number;
      longitudeDegreesEast: number;
      elevationMetersAboveMeanSeaLevel: number;
      locationAccuracyMeters: number | null;
    }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable'; message: string };

export interface ProfileLocationClient {
  requestCurrentLocation(): Promise<CurrentProfileLocationResult>;
  openSettings(): Promise<void>;
}

export const expoProfileLocationClient: ProfileLocationClient = {
  async requestCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return { status: 'denied', canAskAgain: permission.canAskAgain };
    }
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        status: 'granted',
        latitudeDegreesNorth: position.coords.latitude,
        longitudeDegreesEast: position.coords.longitude,
        elevationMetersAboveMeanSeaLevel: position.coords.altitude ?? 0,
        locationAccuracyMeters: position.coords.accuracy,
      };
    } catch {
      return {
        status: 'unavailable',
        message:
          'A current position was not available. Check location services or enter coordinates manually.',
      };
    }
  },
  async openSettings() {
    await Linking.openSettings();
  },
};
