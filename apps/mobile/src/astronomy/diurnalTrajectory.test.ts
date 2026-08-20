import {
  createTargetDiurnalOrbit,
  SIDEREAL_ROTATION_MILLISECONDS,
} from './diurnalTrajectory';

describe('target diurnal orbit', () => {
  it('evaluates one complete bounded sidereal revolution and closes the real IC 1396 track', () => {
    const orbit = createTargetDiurnalOrbit({
      anchorTimestampUtc: '2026-08-20T18:00:00.000Z',
      observer: {
        latitudeDegreesNorth: 42.7,
        longitudeDegreesEast: 23.3,
        elevationMetersAboveMeanSeaLevel: 550,
      },
      target: {
        rightAscensionJ2000Hours: 21.65,
        declinationJ2000Degrees: 57.49,
      },
    });

    expect(orbit.samples.length).toBeGreaterThan(1_400);
    expect(orbit.samples.length).toBeLessThan(1_500);
    expect(
      Date.parse(orbit.samples.at(-1)!.timestampUtc) -
        Date.parse(orbit.samples[0]!.timestampUtc),
    ).toBeCloseTo(SIDEREAL_ROTATION_MILLISECONDS, -1);
    const first = orbit.samples[0]!;
    const last = orbit.samples.at(-1)!;
    const azimuthDifference = Math.abs(
      ((last.azimuthDegreesClockwiseFromNorth -
        first.azimuthDegreesClockwiseFromNorth +
        540) %
        360) -
        180,
    );
    expect(azimuthDifference).toBeLessThan(0.02);
    expect(
      Math.abs(last.refractedAltitudeDegrees - first.refractedAltitudeDegrees),
    ).toBeLessThan(0.02);
  });

  it('rejects invalid anchors instead of creating unbounded work', () => {
    expect(() =>
      createTargetDiurnalOrbit({
        anchorTimestampUtc: 'not-an-instant',
        observer: {
          latitudeDegreesNorth: 42.7,
          longitudeDegreesEast: 23.3,
          elevationMetersAboveMeanSeaLevel: 550,
        },
        target: {
          rightAscensionJ2000Hours: 21.65,
          declinationJ2000Degrees: 57.49,
        },
      }),
    ).toThrow('anchorTimestampUtc');
  });
});
