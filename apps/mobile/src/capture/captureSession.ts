import {
  createTileCoveragePolygon,
  type PanoramaTilePlacement,
} from '../panorama/tileGeometry';

export type RawDeviceRotation = {
  alphaRadians: number;
  betaRadians: number;
  gammaRadians: number;
};

export type OrientationSnapshot = {
  trueHeadingDegrees: number;
  headingAccuracyDegrees: number | null;
  estimatedAltitudeDegrees: number;
  rollDegrees: number;
  rawRotation: RawDeviceRotation | null;
};

export type ReviewedTilePlacement = PanoramaTilePlacement;

export type CaptureSourceKind = 'camera';
export type OrientationConfidence = 'high' | 'medium' | 'low' | 'manual';

export type CapturedProofTile = {
  id: string;
  uri: string;
  widthPixels: number;
  heightPixels: number;
  capturedAtUtc: string;
  orientationSnapshot: OrientationSnapshot;
  reviewedPlacement: ReviewedTilePlacement;
  coveragePolygon: ReturnType<typeof createTileCoveragePolygon>;
  sourceKind: CaptureSourceKind;
  orientationConfidence: OrientationConfidence;
};

export type CreateCapturedTileInput = Omit<
  CapturedProofTile,
  | 'reviewedPlacement'
  | 'coveragePolygon'
  | 'orientationSnapshot'
  | 'sourceKind'
  | 'orientationConfidence'
> & {
  orientation: OrientationSnapshot;
  horizontalFieldOfViewDegrees: number;
  verticalFieldOfViewDegrees: number;
  sourceKind?: CaptureSourceKind;
  motionAvailable?: boolean;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export const MAXIMUM_CAPTURE_EDGE_PIXELS = 12_000;
export const MAXIMUM_CAPTURE_PIXELS = 40_000_000;
export const MINIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES = 0;
export const MAXIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES = 90;

export type GuidedCaptureAltitudeStatus = 'allowed' | 'below-horizon';

const normalizeAzimuthDegrees = (value: number) => ((value % 360) + 360) % 360;

export function assertCaptureDimensionsWithinLimits(
  widthPixels: number,
  heightPixels: number,
): void {
  if (
    !Number.isInteger(widthPixels) ||
    !Number.isInteger(heightPixels) ||
    widthPixels <= 0 ||
    heightPixels <= 0
  ) {
    throw new RangeError('Capture dimensions must be positive integers.');
  }
  if (
    widthPixels > MAXIMUM_CAPTURE_EDGE_PIXELS ||
    heightPixels > MAXIMUM_CAPTURE_EDGE_PIXELS
  ) {
    throw new RangeError('A capture edge cannot exceed 12,000 pixels.');
  }
  if (widthPixels * heightPixels > MAXIMUM_CAPTURE_PIXELS) {
    throw new RangeError('A capture cannot exceed 40 megapixels.');
  }
}

export const captureOrientationConfidence = (
  headingAccuracyDegrees: number | null,
  motionAvailable: boolean,
): OrientationConfidence => {
  if (!motionAvailable || headingAccuracyDegrees === null) {
    return 'manual';
  }
  if (headingAccuracyDegrees <= 15) return 'high';
  if (headingAccuracyDegrees <= 25) return 'medium';
  return 'low';
};

const withCoverage = (
  tile: Omit<CapturedProofTile, 'coveragePolygon'>,
): CapturedProofTile => ({
  ...tile,
  coveragePolygon: createTileCoveragePolygon(tile.reviewedPlacement),
});

export const createCapturedTile = (
  input: CreateCapturedTileInput,
): CapturedProofTile => {
  assertCaptureDimensionsWithinLimits(input.widthPixels, input.heightPixels);
  return withCoverage({
    id: input.id,
    uri: input.uri,
    widthPixels: input.widthPixels,
    heightPixels: input.heightPixels,
    capturedAtUtc: input.capturedAtUtc,
    orientationSnapshot: input.orientation,
    reviewedPlacement: {
      centerAzimuthDegrees: normalizeAzimuthDegrees(
        input.orientation.trueHeadingDegrees,
      ),
      centerAltitudeDegrees: clamp(
        input.orientation.estimatedAltitudeDegrees,
        0,
        90,
      ),
      horizontalFieldOfViewDegrees: input.horizontalFieldOfViewDegrees,
      verticalFieldOfViewDegrees: input.verticalFieldOfViewDegrees,
      rollDegrees: input.orientation.rollDegrees,
    },
    sourceKind: input.sourceKind ?? 'camera',
    orientationConfidence: captureOrientationConfidence(
      input.orientation.headingAccuracyDegrees,
      input.motionAvailable ?? input.orientation.rawRotation !== null,
    ),
  });
};

export const applyTileCorrection = (
  tile: CapturedProofTile,
  correction: {
    azimuthDeltaDegrees: number;
    altitudeDeltaDegrees: number;
    rollDeltaDegrees: number;
  },
): CapturedProofTile =>
  withCoverage({
    ...tile,
    reviewedPlacement: {
      ...tile.reviewedPlacement,
      centerAzimuthDegrees: normalizeAzimuthDegrees(
        tile.reviewedPlacement.centerAzimuthDegrees +
          correction.azimuthDeltaDegrees,
      ),
      centerAltitudeDegrees: clamp(
        tile.reviewedPlacement.centerAltitudeDegrees +
          correction.altitudeDeltaDegrees,
        0,
        90,
      ),
      rollDegrees:
        tile.reviewedPlacement.rollDegrees + correction.rollDeltaDegrees,
    },
  });
