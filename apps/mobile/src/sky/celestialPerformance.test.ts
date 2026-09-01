import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import catalogueJson from '../catalogue/generated/catalogue.json';
import { createCelestialTimeTransform } from '../astronomy/celestialTimeTransform';
import {
  createCelestialCatalogue,
  selectCelestialResidentTargets,
} from './celestialCatalogue';
import { createPlanetariumCamera } from './planetariumProjection';
import { registeredCelestialSky } from './celestialSkyGeometry';
import { selectRegisteredCelestialStarBatches } from './registeredSkyProjection';

const catalogue = catalogueJson as unknown as {
  targets: CatalogueTarget[];
};
const performanceBudgetMilliseconds = process.env.CI ? 150 : 40;

describe('shared celestial preview performance', () => {
  it('selects bounded production residents without rebuilding horizontal catalogues', () => {
    const fixedCatalogue = createCelestialCatalogue(catalogue.targets);
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
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 20,
    });
    const floorTargetIds = new Set(
      fixedCatalogue.slice(0, 100).map(({ target }) => target.id),
    );
    const startedAt = performance.now();
    const residents = selectCelestialResidentTargets({
      camera,
      canvas: { heightPixels: 800, widthPixels: 400 },
      catalogue: fixedCatalogue,
      densityCandidateCount: fixedCatalogue.length,
      floorTargetIds,
      selectedTargetId: null,
      timeTransform: transform,
      timestampMilliseconds: Date.parse('2026-08-20T21:00:00.000Z'),
    });
    const catalogueDurationMilliseconds = performance.now() - startedAt;

    const starsStartedAt = performance.now();
    const starBatches = selectRegisteredCelestialStarBatches({
      camera,
      canvas: { heightPixels: 800, widthPixels: 400 },
      stars: registeredCelestialSky.stars,
      timeTransform: transform,
      timestampMilliseconds: Date.parse('2026-08-20T21:00:00.000Z'),
    });
    const starDurationMilliseconds = performance.now() - starsStartedAt;

    expect(fixedCatalogue).toHaveLength(catalogue.targets.length);
    expect(residents.length).toBeLessThanOrEqual(480);
    expect(
      starBatches.flatMap(({ directions }) => directions).length,
    ).toBeGreaterThan(0);
    expect(catalogueDurationMilliseconds).toBeLessThan(
      performanceBudgetMilliseconds,
    );
    expect(starDurationMilliseconds).toBeLessThan(
      performanceBudgetMilliseconds,
    );
  });
});
