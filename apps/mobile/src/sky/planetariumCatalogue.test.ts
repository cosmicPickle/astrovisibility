import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import catalogue from '../catalogue/generated/catalogue.json';
import { projectCatalogueAtInstant } from './catalogueProjection';
import {
  buildPlanetariumCatalogueIndex,
  layoutPlanetariumTargetLabels,
  isPlanetariumLabelFullyInsideCanvas,
  selectPlanetariumResidentTargets,
  shouldRefreshPlanetariumResidentCatalogue,
  type HorizontalCatalogueTarget,
} from './planetariumCatalogue';
import {
  createPlanetariumCamera,
  projectHorizontalDirection,
} from './planetariumProjection';

const canvas = { widthPixels: 400, heightPixels: 800 };

function target(
  id: string,
  azimuthDegrees: number,
  altitudeDegrees: number,
  options: {
    majorAxisArcminutes?: number;
    minorAxisArcminutes?: number;
    prominenceTier?: 1 | 2 | 3 | 4;
  } = {},
): HorizontalCatalogueTarget {
  const catalogueTarget: CatalogueTarget = {
    id,
    preferredName: id,
    aliases: [id],
    rightAscensionJ2000Hours: 0,
    declinationJ2000Degrees: 0,
    constellation: 'Ori',
    objectType: 'G',
    magnitude: 5,
    memberships: { messier: [], ngc: [], ic: [] },
    prominenceTier: options.prominenceTier ?? 1,
    ...(options.majorAxisArcminutes === undefined
      ? {}
      : { majorAxisArcminutes: options.majorAxisArcminutes }),
    ...(options.minorAxisArcminutes === undefined
      ? {}
      : { minorAxisArcminutes: options.minorAxisArcminutes }),
  };
  return { altitudeDegrees, azimuthDegrees, target: catalogueTarget };
}

const camera = (azimuthDegrees: number, fieldOfViewDegrees = 60) =>
  createPlanetariumCamera({
    centerAltitudeDegrees: 35,
    centerAzimuthDegrees: azimuthDegrees,
    fieldOfViewDegrees,
  });

describe('planetarium resident catalogue', () => {
  it('keeps preloaded labels hidden until their complete text enters the canvas', () => {
    expect(
      isPlanetariumLabelFullyInsideCanvas(
        { xPixels: 20, yPixels: 300 },
        80,
        canvas,
      ),
    ).toBe(false);
    expect(
      isPlanetariumLabelFullyInsideCanvas(
        { xPixels: 200, yPixels: 300 },
        80,
        canvas,
      ),
    ).toBe(true);
  });

  it('preloads targets before they enter during a held horizontal sweep', () => {
    const entering = target('entering', 60, 35, {
      majorAxisArcminutes: 90,
      minorAxisArcminutes: 60,
    });
    const anchorCamera = camera(0);
    const residents = selectPlanetariumResidentTargets(
      buildPlanetariumCatalogueIndex([entering]),
      anchorCamera,
      canvas,
    );

    expect(residents.map((item) => item.target.id)).toContain('entering');
    expect(
      layoutPlanetariumTargetLabels(residents, anchorCamera, canvas).find(
        (item) => item.target.id === 'entering',
      )?.labelVisible,
    ).toBe(true);
    for (const azimuthDegrees of [4, 8, 12, 14]) {
      const liveCamera = camera(azimuthDegrees);
      const point = projectHorizontalDirection(entering, liveCamera, canvas);
      if (
        point.visible &&
        point.xPixels >= 0 &&
        point.xPixels <= canvas.widthPixels &&
        point.yPixels >= 0 &&
        point.yPixels <= canvas.heightPixels
      ) {
        expect(residents.map((item) => item.target.id)).toContain('entering');
      }
      expect(
        shouldRefreshPlanetariumResidentCatalogue(anchorCamera, liveCamera),
      ).toBe(false);
    }
  });

  it('keeps every eligible on-screen target resident through a sweep and immediate reversal', () => {
    const sweepTargets = Array.from({ length: 36 }, (_, index) =>
      target(`sweep-${index}`, index * 10, 35, { prominenceTier: 1 }),
    );
    const index = buildPlanetariumCatalogueIndex(sweepTargets);
    let anchorCamera = camera(0);
    let residents = selectPlanetariumResidentTargets(
      index,
      anchorCamera,
      canvas,
    );
    const cameraCenters = [
      ...Array.from({ length: 91 }, (_, index) => index * 2),
      ...Array.from({ length: 91 }, (_, index) => 180 - index * 2),
    ];

    for (const centerAzimuthDegrees of cameraCenters) {
      const liveCamera = camera(centerAzimuthDegrees);
      if (shouldRefreshPlanetariumResidentCatalogue(anchorCamera, liveCamera)) {
        anchorCamera = liveCamera;
        residents = selectPlanetariumResidentTargets(
          index,
          anchorCamera,
          canvas,
        );
      }
      const residentIds = new Set(residents.map((item) => item.target.id));
      const onScreenIds = sweepTargets
        .filter((item) => {
          const point = projectHorizontalDirection(item, liveCamera, canvas);
          return (
            point.xPixels >= 0 &&
            point.xPixels <= canvas.widthPixels &&
            point.yPixels >= 0 &&
            point.yPixels <= canvas.heightPixels
          );
        })
        .map((item) => item.target.id);
      expect(onScreenIds.every((id) => residentIds.has(id))).toBe(true);
    }
  });

  it('preserves spatial coverage when one cell is much denser than the others', () => {
    const dense = Array.from({ length: 700 }, (_, index) =>
      target(`dense-${index.toString().padStart(3, '0')}`, index % 4, 35, {
        prominenceTier: 1,
      }),
    );
    const spatialAnchors = [
      target('east-anchor', 90, 35, { prominenceTier: 1 }),
      target('south-anchor', 180, 35, { prominenceTier: 1 }),
      target('west-anchor', 270, 35, { prominenceTier: 1 }),
    ];

    const ids = selectPlanetariumResidentTargets(
      buildPlanetariumCatalogueIndex([...dense, ...spatialAnchors]),
      camera(0, 235),
      canvas,
    ).map((item) => item.target.id);

    expect(ids).toEqual(
      expect.arrayContaining(['east-anchor', 'south-anchor', 'west-anchor']),
    );
    expect(ids.length).toBeLessThan(dense.length + spatialAnchors.length);
  });

  it('culls unreadably small known-size objects but retains unknown and selected targets', () => {
    const small = target('small', 0, 35, {
      majorAxisArcminutes: 0.2,
      minorAxisArcminutes: 0.1,
      prominenceTier: 1,
    });
    const unknown = target('unknown', 4, 35, { prominenceTier: 1 });
    const readable = target('readable', 8, 35, {
      majorAxisArcminutes: 90,
      minorAxisArcminutes: 60,
      prominenceTier: 1,
    });
    const index = buildPlanetariumCatalogueIndex([small, unknown, readable]);

    const ordinary = selectPlanetariumResidentTargets(
      index,
      camera(0),
      canvas,
    ).map((item) => item.target.id);
    expect(ordinary).toContain('unknown');
    expect(ordinary).toContain('readable');
    expect(ordinary).not.toContain('small');

    expect(
      selectPlanetariumResidentTargets(index, camera(0), canvas, {
        selectedTargetId: 'small',
      }).map((item) => item.target.id),
    ).toContain('small');
  });

  it('keeps marker membership separate from settled label collision layout', () => {
    const first = target('first', 0, 35, {
      majorAxisArcminutes: 90,
      minorAxisArcminutes: 60,
    });
    const second = target('second', 0.1, 35.1, {
      majorAxisArcminutes: 90,
      minorAxisArcminutes: 60,
    });
    const residents = selectPlanetariumResidentTargets(
      buildPlanetariumCatalogueIndex([first, second]),
      camera(0),
      canvas,
    );
    const laidOut = layoutPlanetariumTargetLabels(residents, camera(0), canvas);

    expect(laidOut).toHaveLength(2);
    expect(laidOut.filter(({ labelVisible }) => labelVisible)).toHaveLength(1);
  });

  it('indexes and selects a production-sized catalogue within a bounded desktop budget', () => {
    const productionTargets = projectCatalogueAtInstant(catalogue.targets, {
      observer: {
        elevationMetersAboveMeanSeaLevel: 550,
        latitudeDegreesNorth: 42.7,
        longitudeDegreesEast: 23.3,
      },
      timestampUtc: '2026-08-20T20:00:00.000Z',
    });
    const startedAt = Date.now();
    const index = buildPlanetariumCatalogueIndex(productionTargets);
    const residents = selectPlanetariumResidentTargets(index, camera(0, 100), {
      widthPixels: 1080,
      heightPixels: 2400,
    });
    const elapsedMilliseconds = Date.now() - startedAt;

    expect(index.targetCount).toBe(13_371);
    expect(residents.length).toBeGreaterThan(20);
    expect(residents.length).toBeLessThanOrEqual(480);
    expect(elapsedMilliseconds).toBeLessThan(process.env.CI ? 500 : 250);
  }, 10_000);
});
