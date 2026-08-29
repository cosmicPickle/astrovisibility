import { createPlanetariumCamera } from './planetariumProjection';
import {
  createRegisteredSkyProjection,
  getSelectedDsoImageOpacity,
  selectRegisteredConstellationLabels,
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
    expect(projection.atlasMeshes).toHaveLength(72);
    expect(
      projection.stars.every(
        ({ altitudeDegrees, azimuthDegrees }) =>
          Number.isFinite(altitudeDegrees) && Number.isFinite(azimuthDegrees),
      ),
    ).toBe(true);
  });
});

describe('selected DSO image visibility', () => {
  it('fades the survey cutout in before the closest zoom level', () => {
    expect(getSelectedDsoImageOpacity(0.71, 24)).toBe(0);
    expect(getSelectedDsoImageOpacity(0.71, 20)).toBeGreaterThan(0);
    expect(getSelectedDsoImageOpacity(0.71, 8)).toBe(0.82);
  });

  it('starts larger cutouts fading in at a wider field of view', () => {
    expect(getSelectedDsoImageOpacity(4.25, 40)).toBe(0);
    expect(getSelectedDsoImageOpacity(4.25, 30)).toBeGreaterThan(0);
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
      id: 'medium',
      magnitude: 5.8,
      colorIndexBv: 0.6,
      altitudeDegrees: 32,
      azimuthDegrees: 2,
    },
    {
      id: 'dim',
      magnitude: 6.8,
      colorIndexBv: 1.2,
      altitudeDegrees: 34,
      azimuthDegrees: 4,
    },
    { id: 'opposite', magnitude: 1, altitudeDegrees: 30, azimuthDegrees: 180 },
  ];
  const canvas = { widthPixels: 390, heightPixels: 780 };

  it('limits wide views and excludes stars outside the resident sphere', () => {
    const batches = selectRegisteredStarBatches(
      stars,
      createPlanetariumCamera({
        centerAltitudeDegrees: 30,
        centerAzimuthDegrees: 0,
        fieldOfViewDegrees: 100,
      }),
      canvas,
    );
    expect(batches.flatMap(({ directions }) => directions)).toEqual([
      expect.objectContaining({ id: 'bright' }),
    ]);
  });

  it('includes magnitude-seven stars in a close view and keeps colour bins', () => {
    const batches = selectRegisteredStarBatches(
      stars,
      createPlanetariumCamera({
        centerAltitudeDegrees: 32,
        centerAzimuthDegrees: 2,
        fieldOfViewDegrees: 15,
      }),
      canvas,
    );
    expect(batches.flatMap(({ directions }) => directions)).toHaveLength(3);
    expect(new Set(batches.map(({ color }) => color)).size).toBe(3);
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
