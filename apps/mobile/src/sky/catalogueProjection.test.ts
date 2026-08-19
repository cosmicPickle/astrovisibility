import referenceFixtures from '../astronomy/__fixtures__/horizontal-reference.json';
import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import { projectCatalogueAtInstant } from './catalogueProjection';

describe('projectCatalogueAtInstant', () => {
  it.each(referenceFixtures)(
    'projects $id to the independently verified horizontal coordinate',
    (fixture) => {
      const target: CatalogueTarget = {
        id: fixture.id,
        preferredName: fixture.id,
        aliases: [fixture.id],
        rightAscensionJ2000Hours: fixture.rightAscensionJ2000Hours,
        declinationJ2000Degrees: fixture.declinationJ2000Degrees,
        constellation: 'fixture',
        objectType: 'fixture',
        memberships: { messier: [], ngc: [], ic: [] },
        prominenceTier: 1,
      };
      const [projected] = projectCatalogueAtInstant([target], {
        timestampUtc: fixture.timestampUtc,
        observer: {
          latitudeDegreesNorth: fixture.latitudeDegreesNorth,
          longitudeDegreesEast: fixture.longitudeDegreesEast,
          elevationMetersAboveMeanSeaLevel:
            fixture.elevationMetersAboveMeanSeaLevel,
        },
      });

      expect(
        Math.abs(
          (projected?.azimuthDegrees ?? Number.POSITIVE_INFINITY) -
            fixture.expectedAzimuthDegreesClockwiseFromNorth,
        ),
      ).toBeLessThanOrEqual(fixture.toleranceDegrees);
      expect(
        Math.abs(
          (projected?.altitudeDegrees ?? Number.POSITIVE_INFINITY) -
            fixture.expectedRefractedAltitudeDegrees,
        ),
      ).toBeLessThanOrEqual(fixture.toleranceDegrees);
    },
  );

  it('omits targets below the astronomical horizon from the browse snapshot', () => {
    const target: CatalogueTarget = {
      id: 'below',
      preferredName: 'Below horizon',
      aliases: ['below'],
      rightAscensionJ2000Hours: 0,
      declinationJ2000Degrees: -80,
      constellation: 'fixture',
      objectType: 'fixture',
      memberships: { messier: [], ngc: [], ic: [] },
      prominenceTier: 1,
    };
    expect(
      projectCatalogueAtInstant([target], {
        timestampUtc: '2026-01-15T20:00:00.000Z',
        observer: {
          latitudeDegreesNorth: 80,
          longitudeDegreesEast: 0,
          elevationMetersAboveMeanSeaLevel: 0,
        },
      }),
    ).toEqual([]);
  });
});
