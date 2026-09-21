import { imagingFrameForEquipment } from './imagingFrameSettings';
import {
  createObstructionClassifier,
  createVisibilityCalculationContextKey,
} from '../astronomy/obstructionVisibility';
import { createBlockedBitset } from '../mask/rasterMask';
import { physicalWindow } from '../window/__fixtures__/physicalWindow';
import { createWindowGeometry } from '../window/windowGeometry';

it('uses the saved aperture for visibility and invalidates results when its size changes', () => {
  const settings = imagingFrameForEquipment({
    id: 'synthetic',
    name: 'Synthetic',
    focalLengthMillimeters: 150,
    apertureMillimeters: 35,
    sensorWidthPixels: 3840,
    sensorHeightPixels: 2160,
    pixelSizeMicrometers: 2,
    lensOffsetMillimeters: 50,
    createdAtUtc: '2026-01-01T00:00:00Z',
    updatedAtUtc: '2026-01-01T00:00:00Z',
  })!;
  expect(settings.apertureMillimeters).toBe(35);
  const raster = {
    uri: 'synthetic',
    widthPixels: 128,
    heightPixels: 128,
    blockedBitset: createBlockedBitset(128, 128, false),
  };
  const input = {
    profileId: 'synthetic',
    panoramaRevisionId: 'p',
    timeZoneId: 'UTC',
    window: {
      startTimestampUtc: '2026-01-01T00:00:00Z',
      endTimestampUtc: '2026-01-01T01:00:00Z',
    },
    observer: {
      latitudeDegreesNorth: 44,
      longitudeDegreesEast: 0,
      elevationMetersAboveMeanSeaLevel: 0,
    },
    imagingFrame: settings,
    maskRevision: {
      id: 'm',
      panoramaRevisionId: 'p',
      mask: {
        coveragePolygons: [],
        operations: [],
        raster,
        windowCorrection: {
          geometry: createWindowGeometry(physicalWindow(1.2, 178).definition),
          backgroundRaster: raster,
        },
      },
    },
  };
  const point = {
    ...input,
    imagingFrame: { ...settings, apertureMillimeters: 0 },
  };
  const direction = {
    azimuthDegreesClockwiseFromNorth: 82,
    refractedAltitudeDegrees: 20,
  };
  expect(createObstructionClassifier(input)(direction)).toBe('blocked');
  expect(createObstructionClassifier(point)(direction)).toBe('visible');
  expect(createVisibilityCalculationContextKey(input)).not.toBe(
    createVisibilityCalculationContextKey(point),
  );
  expect(
    createObstructionClassifier({
      ...input,
      maskRevision: {
        ...input.maskRevision,
        mask: { ...input.maskRevision.mask, windowCorrection: undefined },
      },
    })(direction),
  ).toBe('visible');
  expect(imagingFrameForEquipment(null)).toBeNull();
});
