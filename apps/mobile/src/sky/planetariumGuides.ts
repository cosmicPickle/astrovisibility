import {
  equatorialJ2000ToHorizontal,
  type ObserverLocation,
} from '../astronomy/horizontalCoordinates';
import type { HorizontalDirectionDegrees } from './projection';

/** One-degree exact samples of the observed celestial equator. */
export const createCelestialEquatorGuide = (input: {
  observer: ObserverLocation;
  timestampUtc: string;
}): HorizontalDirectionDegrees[] =>
  Array.from({ length: 361 }, (_, index) => {
    const horizontal = equatorialJ2000ToHorizontal({
      rightAscensionJ2000Hours: (index % 360) / 15,
      declinationJ2000Degrees: 0,
      observer: input.observer,
      timestampUtc: input.timestampUtc,
    });
    return {
      altitudeDegrees: horizontal.refractedAltitudeDegrees,
      azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
    };
  });
