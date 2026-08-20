import type { ObserverLocation } from '../astronomy/horizontalCoordinates';
import type { ProfileRecord } from '../storage/profileRepository';

export const observerForProfile = (
  profile: ProfileRecord,
): ObserverLocation => ({
  elevationMetersAboveMeanSeaLevel: profile.elevationMetersAboveMeanSeaLevel,
  latitudeDegreesNorth: profile.latitudeDegreesNorth,
  longitudeDegreesEast: profile.longitudeDegreesEast,
});
