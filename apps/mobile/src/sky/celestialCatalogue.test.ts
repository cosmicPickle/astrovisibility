import { createCelestialTimeTransform } from '../astronomy/celestialTimeTransform';
import { createPlanetariumCamera } from './planetariumProjection';
import {
  createCelestialCatalogue,
  selectCelestialResidentTargets,
} from './celestialCatalogue';

const target = {
  aliases: ['M 42'],
  constellation: 'Ori',
  declinationJ2000Degrees: -5.391,
  id: 'M42',
  magnitude: 4,
  memberships: { caldwell: undefined, ic: [], messier: [42], ngc: ['1976'] },
  objectType: 'Neb',
  positionAngleDegrees: 0,
  preferredName: 'Orion Nebula',
  prominenceTier: 1 as const,
  rightAscensionJ2000Hours: 5.588,
};

describe('fixed J2000 catalogue residency', () => {
  it('keeps catalogue identities fixed while selecting at different times', () => {
    const catalogue = createCelestialCatalogue([target]);
    const transform = createCelestialTimeTransform({
      observer: {
        elevationMetersAboveMeanSeaLevel: 550,
        latitudeDegreesNorth: 42.7,
        longitudeDegreesEast: 23.3,
      },
      window: {
        startTimestampUtc: '2026-08-20T09:00:00.000Z',
        endTimestampUtc: '2026-08-21T09:00:00.000Z',
      },
    });
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 235,
    });
    const shared = {
      camera,
      canvas: { heightPixels: 800, widthPixels: 400 },
      catalogue,
      densityCandidateCount: 1,
      floorTargetIds: new Set(['M42']),
      selectedTargetId: 'M42',
      timeTransform: transform,
    };

    const early = selectCelestialResidentTargets({
      ...shared,
      timestampMilliseconds: Date.parse('2026-08-20T12:00:00.000Z'),
    });
    const late = selectCelestialResidentTargets({
      ...shared,
      timestampMilliseconds: Date.parse('2026-08-21T03:00:00.000Z'),
    });

    expect(catalogue[0]!.target).toBe(target);
    expect(early[0]?.target).toBe(target);
    expect(late[0]?.target).toBe(target);
    expect(early[0]?.azimuthDegrees).not.toBe(late[0]?.azimuthDegrees);
  });
});
