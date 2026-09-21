import { createImagingFrame } from '../astronomy/imagingFrame';
import { createObstructionClassifier } from '../astronomy/obstructionVisibility';
import { createBlockedBitset, writeBlockedPixel } from '../mask/rasterMask';
import { atlasPixelToDirection } from '../panorama/directionalAtlas';
import { horizontalDirectionToVector } from '../sky/planetariumProjection';
import { physicalWindow } from './__fixtures__/physicalWindow';
import { lensPositionMeters } from './windowGeometry';
import { prepareWindowCorrection } from './windowMask';

/** Known model limitation: the painted near edge is inside the ideal rectangle.
 * Current classification treats it as distant. These assertions document the
 * false clear; replace them with physical expectations when depth is represented.
 * Synthetic only: this does not reconstruct the user's window. */
it('demonstrates uncorrected near mask edges despite lens and pupil correction', async () => {
  const fixture = physicalWindow(1.2, 178);
  const nearRightEdgeMeters = 0.18;
  const raster = {
    uri: 'synthetic-near-frame',
    widthPixels: 512,
    heightPixels: 512,
    blockedBitset: createBlockedBitset(512, 512, true),
  };
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const direction = atlasPixelToDirection(
        { xPixels: x, yPixels: y },
        raster,
      );
      if (!direction) continue;
      const ray = horizontalDirectionToVector(direction);
      if (ray.z <= 0) continue;
      const across = (fixture.depth * ray.x) / ray.z;
      const height = (fixture.depth * ray.y) / ray.z;
      // A stepped frame intrudes only above 5 mm; the bounding rectangle is
      // still 1.2 m wide, with unobstructed space below the intrusion.
      const right = height > 0.005 ? nearRightEdgeMeters : 0.6;
      const clear = across > -0.6 && across < right && height < 1.1;
      writeBlockedPixel(raster.blockedBitset, 512, 512, x, y, !clear);
    }
  const correction = await prepareWindowCorrection(
    raster,
    createBlockedBitset(512, 512, true),
    fixture.definition,
    async () => undefined,
  );
  const settings = {
    horizontalFovDegrees: 3,
    verticalFovDegrees: 2,
    orientationDegrees: 0,
    trackingMode: 'altaz' as const,
    lensOffsetMillimeters: 50,
    apertureMillimeters: 35,
  };
  const classify = createObstructionClassifier({
    observer: {
      latitudeDegreesNorth: 44,
      longitudeDegreesEast: 0,
      elevationMetersAboveMeanSeaLevel: 0,
    },
    imagingFrame: settings,
    maskRevision: {
      id: 'synthetic-mask',
      panoramaRevisionId: 'synthetic-panorama',
      mask: {
        raster,
        windowCorrection: correction,
        coveragePolygons: [],
        operations: [],
      },
    },
  });
  const horizontal = {
    azimuthDegreesClockwiseFromNorth: 75,
    refractedAltitudeDegrees: 20,
  };
  const lens = lensPositionMeters(
    { azimuthDegrees: 75, altitudeDegrees: 20 },
    50,
    'altaz',
    44,
  );
  const ray = horizontalDirectionToVector({
    azimuthDegrees: 75,
    altitudeDegrees: 20,
  });
  const travel = (fixture.depth - lens.z) / ray.z;
  expect(lens.y + travel * ray.y).toBeGreaterThan(0.005);
  expect(lens.x + travel * ray.x).toBeGreaterThan(nearRightEdgeMeters);
  expect(classify(horizontal)).toBe('visible');

  // Scaling this painted obstruction away from the capture point preserves
  // every original mask direction but changes its parallax. The same input
  // mask therefore cannot say which physical result applies without depth.
  const farScale = 100;
  const farTravel = (fixture.depth * farScale - lens.z) / ray.z;
  expect(lens.x + farTravel * ray.x).toBeLessThan(
    nearRightEdgeMeters * farScale,
  );

  let physicalEnd: number | undefined;
  let modelEnd: number | undefined;
  // Synthetic 11 degree/hour right-edge sweep; no astronomical time claim.
  for (let second = 0; second <= 14400; second++) {
    const azimuth = 45 + (second * 11) / 3600;
    const position = {
      azimuthDegreesClockwiseFromNorth: azimuth,
      refractedAltitudeDegrees: 20,
    };
    if (modelEnd === undefined && classify(position) === 'blocked')
      modelEnd = second;
    const frame = createImagingFrame({
      ...settings,
      observerLatitudeDegrees: 44,
      horizontal: position,
    });
    const pupilCenter = lensPositionMeters(
      { azimuthDegrees: azimuth, altitudeDegrees: 20 },
      50,
      'altaz',
      44,
    );
    // A single real ray hitting the known opaque part suffices to prove shading.
    // The rightmost pupil point is independent of the runtime pupil evaluator.
    const pupil = {
      x: pupilCenter.x + 0.0175 * frame.right.x,
      y: pupilCenter.y + 0.0175 * frame.right.y,
      z: pupilCenter.z + 0.0175 * frame.right.z,
    };
    const blocked = frame.corners.some((corner) => {
      const distance = (fixture.depth - pupil.z) / corner.z;
      const across = pupil.x + distance * corner.x;
      const height = pupil.y + distance * corner.y;
      return (
        distance > 0 &&
        across > nearRightEdgeMeters &&
        height > 0.005 &&
        height < 1.1
      );
    });
    if (physicalEnd === undefined && blocked) physicalEnd = second;
    if (physicalEnd !== undefined && modelEnd !== undefined) break;
  }
  expect(physicalEnd).toBeDefined();
  expect(modelEnd).toBeDefined();
  expect(modelEnd! - physicalEnd!).toBeGreaterThan(3600);
  console.info('near_mask_model_gap', {
    physicalEndSeconds: physicalEnd,
    modelEndSeconds: modelEnd,
  });
});
