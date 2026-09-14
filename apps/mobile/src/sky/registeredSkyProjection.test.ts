import { createPlanetariumCamera } from './planetariumProjection';
import {
  MINIMUM_CONSTELLATION_CANVAS_AREA_FRACTION,
  createRegisteredSkyProjection,
  getRegisteredDsoImageOpacity,
  getRegisteredStarBatchOpacity,
  selectRegisteredConstellationLabels,
  selectVisibleRegisteredConstellations,
  selectRegisteredDsoImages,
  selectRegisteredStarBatches,
} from './registeredSkyProjection';

describe('registered sky projection', () => {
  it('projects every bounded generated layer into finite horizontal coordinates', () => {
    const projection = createRegisteredSkyProjection({
      observer: {
        elevationMetersAboveMeanSeaLevel: 540,
        latitudeDegreesNorth: 42.6977,
        longitudeDegreesEast: 23.3219,
      },
      timestampUtc: '2026-08-29T21:15:00.000Z',
    });

    expect(projection.stars).toHaveLength(15_598);
    expect(projection.constellations).toHaveLength(88);
    expect(projection.celestialOrientation?.eastJ2000).toHaveLength(3);
    expect(
      Object.values(projection.celestialOrientation!)
        .flat()
        .every(Number.isFinite),
    ).toBe(true);
    expect(
      projection.stars.every(
        ({ altitudeDegrees, azimuthDegrees }) =>
          Number.isFinite(altitudeDegrees) && Number.isFinite(azimuthDegrees),
      ),
    ).toBe(true);
  });
});

describe('selected DSO image visibility', () => {
  it('fades a survey cutout according to its useful on-screen diameter', () => {
    expect(getRegisteredDsoImageOpacity(0.71, 24, 390)).toBe(0);
    expect(getRegisteredDsoImageOpacity(0.71, 12, 390)).toBeGreaterThan(0);
    expect(getRegisteredDsoImageOpacity(0.71, 5, 390)).toBe(0.9);
  });

  it('allows physically larger cutouts to appear in wider views', () => {
    expect(getRegisteredDsoImageOpacity(4.25, 110, 390)).toBe(0);
    expect(getRegisteredDsoImageOpacity(4.25, 100, 390)).toBeGreaterThan(0);
    expect(getRegisteredDsoImageOpacity(4.25, 30, 390)).toBe(0.9);
  });

  it('selects every close in-frame cutout and draws the selected one last', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 12,
    });
    const mesh = (
      azimuthDegrees: number,
    ): Parameters<typeof selectRegisteredDsoImages>[0][number]['mesh'] => ({
      angularRadiusDegrees: 1,
      centerDirection: { altitudeDegrees: 30, azimuthDegrees },
      columnCount: 1,
      directions: [],
      indices: [],
      rowCount: 1,
      texturePointsPixels: [],
    });

    const selected = selectRegisteredDsoImages(
      [
        { targetId: 'near', mesh: mesh(2), source: 1 },
        { targetId: 'selected', mesh: mesh(0), source: 2 },
        { targetId: 'opposite', mesh: mesh(180), source: 3 },
      ],
      camera,
      { heightPixels: 780, widthPixels: 390 },
      'selected',
    );

    expect(selected.map(({ targetId }) => targetId)).toEqual([
      'near',
      'selected',
    ]);
  });

  it('does not mount in-frame cutouts before their zoom threshold', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 100,
    });

    expect(
      selectRegisteredDsoImages(
        [
          {
            targetId: 'wide-view-hidden',
            mesh: {
              angularRadiusDegrees: 1,
              centerDirection: { altitudeDegrees: 30, azimuthDegrees: 0 },
              columnCount: 1,
              directions: [],
              indices: [],
              rowCount: 1,
              texturePointsPixels: [],
            },
            source: 1,
          },
        ],
        camera,
        { heightPixels: 780, widthPixels: 390 },
        null,
      ),
    ).toEqual([]);
  });
});

describe('registered star density', () => {
  const stars = [
    {
      id: 'bright',
      magnitude: 1,
      colorIndexBv: -0.1,
      altitudeDegrees: 30,
      azimuthDegrees: 0,
    },
    {
      id: 'wide-fade',
      magnitude: 4.5,
      colorIndexBv: 0.3,
      altitudeDegrees: 31,
      azimuthDegrees: 1,
    },
    {
      id: 'near-fade',
      magnitude: 5.2,
      colorIndexBv: 0.4,
      altitudeDegrees: 31.5,
      azimuthDegrees: 1.5,
    },
    {
      id: 'medium',
      magnitude: 5.8,
      colorIndexBv: 0.6,
      altitudeDegrees: 32,
      azimuthDegrees: 2,
    },
    {
      id: 'dim',
      magnitude: 6.6,
      colorIndexBv: 1.2,
      altitudeDegrees: 34,
      azimuthDegrees: 4,
    },
    {
      id: 'beyond-limit',
      magnitude: 6.8,
      colorIndexBv: 1.2,
      altitudeDegrees: 35,
      azimuthDegrees: 5,
    },
    { id: 'opposite', magnitude: 1, altitudeDegrees: 30, azimuthDegrees: 180 },
  ];
  const canvas = { widthPixels: 390, heightPixels: 780 };

  it('limits wide views to a bright foundation plus one faint prefetch band', () => {
    const batches = selectRegisteredStarBatches(
      stars,
      createPlanetariumCamera({
        centerAltitudeDegrees: 30,
        centerAzimuthDegrees: 0,
        fieldOfViewDegrees: 100,
      }),
      canvas,
    );
    expect(
      batches.flatMap(({ directions }) => directions).map(({ id }) => id),
    ).toEqual(['bright', 'wide-fade']);
    expect(
      batches
        .filter((batch) => getRegisteredStarBatchOpacity(batch, 100) >= 0.1)
        .flatMap(({ directions }) => directions)
        .map(({ id }) => id),
    ).toEqual(['bright']);
  });

  it('fades a prefetched magnitude band continuously before it becomes full', () => {
    const batches = selectRegisteredStarBatches(
      stars,
      createPlanetariumCamera({
        centerAltitudeDegrees: 32,
        centerAzimuthDegrees: 2,
        fieldOfViewDegrees: 80,
      }),
      canvas,
    );
    const enteringBatch = batches.find(({ directions }) =>
      directions.some(({ id }) => id === 'near-fade'),
    );

    expect(enteringBatch).toBeDefined();
    expect(getRegisteredStarBatchOpacity(enteringBatch!, 70)).toBe(0);
    expect(getRegisteredStarBatchOpacity(enteringBatch!, 55)).toBeGreaterThan(
      0,
    );
    expect(getRegisteredStarBatchOpacity(enteringBatch!, 55)).toBeLessThan(1);
    expect(getRegisteredStarBatchOpacity(enteringBatch!, 40)).toBe(1);
  });

  it('prefetches but hides the faintest band until a closer view', () => {
    const batches = selectRegisteredStarBatches(
      stars,
      createPlanetariumCamera({
        centerAltitudeDegrees: 32,
        centerAzimuthDegrees: 2,
        fieldOfViewDegrees: 15,
      }),
      canvas,
    );
    const directions = batches.flatMap(({ directions }) => directions);
    expect(directions).toHaveLength(5);
    expect(directions.map(({ id }) => id)).not.toContain('beyond-limit');
    const dimBatch = batches.find(({ directions: batchDirections }) =>
      batchDirections.some(({ id }) => id === 'dim'),
    );
    expect(dimBatch).toBeDefined();
    expect(getRegisteredStarBatchOpacity(dimBatch!, 15)).toBe(0);
    expect(getRegisteredStarBatchOpacity(dimBatch!, 10)).toBeGreaterThan(0);
    expect(getRegisteredStarBatchOpacity(dimBatch!, 10)).toBeLessThan(1);
    expect(getRegisteredStarBatchOpacity(dimBatch!, 7)).toBe(1);
    expect(new Set(batches.map(({ color }) => color)).size).toBe(3);
    expect(
      batches.every(
        ({ haloRadiusPixels, radiusPixels }) => haloRadiusPixels > radiusPixels,
      ),
    ).toBe(true);
    expect(Math.max(...batches.map(({ radiusPixels }) => radiusPixels))).toBe(
      1.85,
    );
    const brightBatch = batches.find(({ directions: batchDirections }) =>
      batchDirections.some(({ id }) => id === 'bright'),
    );
    expect(brightBatch?.outerHaloRadiusPixels).toBeGreaterThan(
      brightBatch!.haloRadiusPixels,
    );
  });
});

describe('constellation label layout', () => {
  it('suppresses labels that would clip at a canvas edge', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 40,
    });
    const labels = selectRegisteredConstellationLabels(
      [
        {
          id: 'edge',
          label: { altitudeDegrees: 30, azimuthDegrees: 19 },
          lines: [],
          name: 'Long constellation name',
          rank: 1,
        },
      ],
      camera,
      { heightPixels: 400, widthPixels: 200 },
    );

    expect(labels).toEqual([]);
  });
});

describe('constellation figure culling', () => {
  const camera = createPlanetariumCamera({
    centerAltitudeDegrees: 30,
    centerAzimuthDegrees: 0,
    fieldOfViewDegrees: 100,
  });
  const canvas = { heightPixels: 400, widthPixels: 400 };
  const constellation = (
    id: string,
    lines: { altitudeDegrees: number; azimuthDegrees: number }[][],
  ) => ({
    id,
    label: { altitudeDegrees: 30, azimuthDegrees: 0 },
    lines,
    name: id,
    rank: 1,
  });

  it('keeps only complete figures whose projected bounds cover five percent', () => {
    expect(MINIMUM_CONSTELLATION_CANVAS_AREA_FRACTION).toBe(0.05);
    const large = constellation('large', [
      [
        { altitudeDegrees: 5, azimuthDegrees: 330 },
        { altitudeDegrees: 55, azimuthDegrees: 30 },
      ],
      [
        { altitudeDegrees: 55, azimuthDegrees: 330 },
        { altitudeDegrees: 5, azimuthDegrees: 30 },
      ],
    ]);
    const small = constellation('small', [
      [
        { altitudeDegrees: 29, azimuthDegrees: 359 },
        { altitudeDegrees: 31, azimuthDegrees: 1 },
      ],
    ]);
    const clipped = constellation('clipped', [
      [
        { altitudeDegrees: 5, azimuthDegrees: 330 },
        { altitudeDegrees: 30, azimuthDegrees: 120 },
      ],
    ]);

    expect(
      selectVisibleRegisteredConstellations(
        [small, clipped, large],
        camera,
        canvas,
      ).map(({ id }) => id),
    ).toEqual(['large']);
  });

  it('never mounts an empty constellation figure', () => {
    expect(
      selectVisibleRegisteredConstellations(
        [constellation('empty', [])],
        camera,
        canvas,
      ),
    ).toEqual([]);
  });
});
