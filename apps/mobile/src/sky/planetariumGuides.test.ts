import { createCelestialEquatorGuide } from './planetariumGuides';

describe('planetarium coordinate-frame guides', () => {
  it('projects the celestial equator from equatorial coordinates instead of fixing it to the screen', () => {
    const equatorialObserverGuide = createCelestialEquatorGuide({
      observer: {
        latitudeDegreesNorth: 0,
        longitudeDegreesEast: 0,
        elevationMetersAboveMeanSeaLevel: 0,
      },
      timestampUtc: '2026-08-20T00:00:00.000Z',
    });
    const midLatitudeGuide = createCelestialEquatorGuide({
      observer: {
        latitudeDegreesNorth: 45,
        longitudeDegreesEast: 0,
        elevationMetersAboveMeanSeaLevel: 0,
      },
      timestampUtc: '2026-08-20T00:00:00.000Z',
    });

    expect(
      Math.max(
        ...equatorialObserverGuide.map(
          ({ altitudeDegrees }) => altitudeDegrees,
        ),
      ),
    ).toBeGreaterThan(89);
    expect(
      Math.max(
        ...midLatitudeGuide.map(({ altitudeDegrees }) => altitudeDegrees),
      ),
    ).toBeLessThan(46);
    expect(midLatitudeGuide).not.toEqual(equatorialObserverGuide);
  });
});
