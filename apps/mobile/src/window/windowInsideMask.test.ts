import {
  createObstructionClassifier,
  createVisibilityCalculationContextKey,
} from '../astronomy/obstructionVisibility';
import { createBlockedBitset, readBlockedPixel } from '../mask/rasterMask';
import { atlasPixelToDirection } from '../panorama/directionalAtlas';
import { horizontalDirectionToVector } from '../sky/planetariumProjection';
import { physicalWindow } from './__fixtures__/physicalWindow';
import { createWindowGeometry } from './windowGeometry';
import { prepareWindowCorrection } from './windowMask';

it('cannot clear blocked source pixels when a 178-degree window is applied without lens displacement', async () => {
  const raster = {
    uri: 'synthetic',
    widthPixels: 128,
    heightPixels: 128,
    blockedBitset: createBlockedBitset(128, 128, false),
  };
  // Deterministic mixed obstacles and photographed/unphotographed coverage.
  raster.blockedBitset.fill(0x55);
  const original = raster.blockedBitset.slice();
  const coverage = createBlockedBitset(128, 128, false);
  coverage.fill(0xdd);
  const observer = {
    latitudeDegreesNorth: 44,
    longitudeDegreesEast: 0,
    elevationMetersAboveMeanSeaLevel: 0,
  };
  for (const width of [1.2, 1.6])
    for (const across of [0.1, 0.5, 0.9]) {
      const fixture = physicalWindow(width, 178, across, 180);
      const correction = await prepareWindowCorrection(
        raster,
        coverage,
        fixture.definition,
        async () => undefined,
      );
      const classify = createObstructionClassifier({
        observer,
        imagingFrame: null,
        maskRevision: {
          id: 'm',
          panoramaRevisionId: 'p',
          mask: {
            coveragePolygons: [],
            operations: [],
            raster,
            windowCorrection: correction,
          },
        },
      });
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++) {
          const direction = atlasPixelToDirection(
            { xPixels: x, yPixels: y },
            raster,
          );
          if (!direction) continue;
          const expectedVisible =
            readBlockedPixel(coverage, 128, 128, x, y) &&
            !readBlockedPixel(original, 128, 128, x, y) &&
            fixture.rayClearsOpening(horizontalDirectionToVector(direction), {
              x: 0,
              y: 0,
              z: 0,
            });
          expect(
            classify({
              azimuthDegreesClockwiseFromNorth: direction.azimuthDegrees,
              refractedAltitudeDegrees: direction.altitudeDegrees,
            }),
          ).toBe(expectedVisible ? 'visible' : 'blocked');
        }
      expect(raster.blockedBitset).toEqual(original);
    }
});

it('invalidates cached results for every saved window geometry parameter', () => {
  const definition = physicalWindow(1.6, 178).definition;
  const raster = {
    uri: 'synthetic',
    widthPixels: 128,
    heightPixels: 128,
    blockedBitset: createBlockedBitset(128, 128, false),
  };
  const keyFor = (edited: typeof definition) =>
    createVisibilityCalculationContextKey({
      profileId: 'synthetic',
      panoramaRevisionId: 'p',
      timeZoneId: 'UTC',
      observer: {
        latitudeDegreesNorth: 44,
        longitudeDegreesEast: 0,
        elevationMetersAboveMeanSeaLevel: 0,
      },
      window: {
        startTimestampUtc: '2026-09-20T21:00:00.000Z',
        endTimestampUtc: '2026-09-21T03:00:00.000Z',
      },
      maskRevision: {
        id: 'm',
        panoramaRevisionId: 'p',
        mask: {
          coveragePolygons: [],
          operations: [],
          raster,
          windowCorrection: {
            geometry: createWindowGeometry(edited),
            backgroundRaster: raster,
          },
        },
      },
    });
  const original = keyFor(definition);
  for (const field of [
    'leftAzimuthDegrees',
    'rightAzimuthDegrees',
    'topSlope',
    'bottomSlope',
    'rightDistanceRatio',
    'widthMeters',
  ] as const)
    expect(
      keyFor({ ...definition, [field]: definition[field] + 0.01 }),
    ).not.toBe(original);
});
