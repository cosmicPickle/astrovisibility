import {
  normalizeAzimuthDegrees,
  unwrapAzimuthDegreesNear,
  type CanvasSizePixels,
  type HorizontalDirectionDegrees,
} from './projection';

export const MINIMUM_HORIZONTAL_SPAN_DEGREES = 12;
export const MAXIMUM_HORIZONTAL_SPAN_DEGREES = 360;

export interface SkyViewport {
  centerAzimuthDegrees: number;
  centerAltitudeDegrees: number;
  horizontalSpanDegrees: number;
}

type TrajectoryViewportPoint = Readonly<{
  refractedAltitudeDegrees: number;
  unwrappedAzimuthDegrees: number;
}>;

interface SkyPanGesture {
  translationXPixels: number;
  translationYPixels: number;
}

interface SkyZoomGesture {
  focalXPixels: number;
  focalYPixels: number;
  scale: number;
}

export interface SkyNavigationGesture extends SkyPanGesture, SkyZoomGesture {}

const assertCanvas = (canvas: CanvasSizePixels) => {
  if (canvas.widthPixels <= 0 || canvas.heightPixels <= 0) {
    throw new RangeError('Canvas dimensions must be positive');
  }
};

export const getVerticalSpanDegrees = (
  viewport: Pick<SkyViewport, 'horizontalSpanDegrees'>,
  canvas: CanvasSizePixels,
) => {
  assertCanvas(canvas);
  return Math.min(
    90,
    viewport.horizontalSpanDegrees * (canvas.heightPixels / canvas.widthPixels),
  );
};

const clampCenterAltitude = (
  centerAltitudeDegrees: number,
  verticalSpanDegrees: number,
) => {
  const halfSpan = verticalSpanDegrees / 2;
  return Math.max(halfSpan, Math.min(90 - halfSpan, centerAltitudeDegrees));
};

export const createSkyViewport = (viewport: SkyViewport): SkyViewport => {
  if (
    !Number.isFinite(viewport.horizontalSpanDegrees) ||
    viewport.horizontalSpanDegrees < MINIMUM_HORIZONTAL_SPAN_DEGREES ||
    viewport.horizontalSpanDegrees > MAXIMUM_HORIZONTAL_SPAN_DEGREES
  ) {
    throw new RangeError(
      `horizontalSpanDegrees must be ${MINIMUM_HORIZONTAL_SPAN_DEGREES}..${MAXIMUM_HORIZONTAL_SPAN_DEGREES}`,
    );
  }
  if (!Number.isFinite(viewport.centerAltitudeDegrees)) {
    throw new RangeError('centerAltitudeDegrees must be finite');
  }
  return {
    centerAzimuthDegrees: normalizeAzimuthDegrees(
      viewport.centerAzimuthDegrees,
    ),
    centerAltitudeDegrees: Math.max(
      0,
      Math.min(90, viewport.centerAltitudeDegrees),
    ),
    horizontalSpanDegrees: viewport.horizontalSpanDegrees,
  };
};

/** Builds a padded view of every above-horizon sample using the trajectory's
 * already-unwrapped azimuths, so north crossings remain compact. */
export const createTrajectoryInspectionViewport = (
  samples: readonly TrajectoryViewportPoint[],
  canvas: CanvasSizePixels,
): SkyViewport | null => {
  assertCanvas(canvas);
  const visibleSamples = samples.filter(
    ({ refractedAltitudeDegrees }) => refractedAltitudeDegrees >= 0,
  );
  if (visibleSamples.length === 0) return null;
  const azimuths = visibleSamples.map(
    ({ unwrappedAzimuthDegrees }) => unwrappedAzimuthDegrees,
  );
  const altitudes = visibleSamples.map(
    ({ refractedAltitudeDegrees }) => refractedAltitudeDegrees,
  );
  const minimumAzimuth = Math.min(...azimuths);
  const maximumAzimuth = Math.max(...azimuths);
  const minimumAltitude = Math.min(...altitudes);
  const maximumAltitude = Math.max(...altitudes);
  const azimuthSpan = (maximumAzimuth - minimumAzimuth) * 1.2;
  const altitudeSpan = (maximumAltitude - minimumAltitude) * 1.2;
  const horizontalSpanForAltitude =
    altitudeSpan * (canvas.widthPixels / canvas.heightPixels);
  return constrainSkyViewport(
    {
      centerAzimuthDegrees: (minimumAzimuth + maximumAzimuth) / 2,
      centerAltitudeDegrees: (minimumAltitude + maximumAltitude) / 2,
      horizontalSpanDegrees: Math.max(
        MINIMUM_HORIZONTAL_SPAN_DEGREES,
        Math.min(
          MAXIMUM_HORIZONTAL_SPAN_DEGREES,
          Math.max(azimuthSpan, horizontalSpanForAltitude),
        ),
      ),
    },
    canvas,
  );
};

export const constrainSkyViewport = (
  viewport: SkyViewport,
  canvas: CanvasSizePixels,
): SkyViewport => {
  const normalized = createSkyViewport(viewport);
  return {
    ...normalized,
    centerAltitudeDegrees: clampCenterAltitude(
      normalized.centerAltitudeDegrees,
      getVerticalSpanDegrees(normalized, canvas),
    ),
  };
};

export const projectDirectionToViewport = (
  direction: HorizontalDirectionDegrees,
  rawViewport: SkyViewport,
  canvas: CanvasSizePixels,
  options: { overscanRatio?: number } = {},
) => {
  const viewport = constrainSkyViewport(rawViewport, canvas);
  if (direction.altitudeDegrees < 0 || direction.altitudeDegrees > 90) {
    return null;
  }
  const verticalSpanDegrees = getVerticalSpanDegrees(viewport, canvas);
  const unwrappedAzimuthDegrees = unwrapAzimuthDegreesNear(
    direction.azimuthDegrees,
    viewport.centerAzimuthDegrees,
  );
  const azimuthOffsetDegrees =
    unwrappedAzimuthDegrees - viewport.centerAzimuthDegrees;
  const altitudeOffsetDegrees =
    direction.altitudeDegrees - viewport.centerAltitudeDegrees;
  const overscanRatio = Math.max(0, options.overscanRatio ?? 0);
  const spanMultiplier = 1 + overscanRatio * 2;
  if (
    Math.abs(azimuthOffsetDegrees) >
      (viewport.horizontalSpanDegrees / 2) * spanMultiplier ||
    Math.abs(altitudeOffsetDegrees) > (verticalSpanDegrees / 2) * spanMultiplier
  ) {
    return null;
  }
  return {
    xPixels:
      (0.5 + azimuthOffsetDegrees / viewport.horizontalSpanDegrees) *
      canvas.widthPixels,
    yPixels:
      (0.5 - altitudeOffsetDegrees / verticalSpanDegrees) * canvas.heightPixels,
  };
};

export const applySkyPan = (
  rawViewport: SkyViewport,
  canvas: CanvasSizePixels,
  gesture: SkyPanGesture,
) => {
  const viewport = constrainSkyViewport(rawViewport, canvas);
  const verticalSpanDegrees = getVerticalSpanDegrees(viewport, canvas);
  return constrainSkyViewport(
    {
      ...viewport,
      centerAzimuthDegrees:
        viewport.centerAzimuthDegrees -
        (gesture.translationXPixels / canvas.widthPixels) *
          viewport.horizontalSpanDegrees,
      centerAltitudeDegrees:
        viewport.centerAltitudeDegrees +
        (gesture.translationYPixels / canvas.heightPixels) *
          verticalSpanDegrees,
    },
    canvas,
  );
};

export const applySkyZoom = (
  rawViewport: SkyViewport,
  canvas: CanvasSizePixels,
  gesture: SkyZoomGesture,
) => {
  if (!Number.isFinite(gesture.scale) || gesture.scale <= 0) {
    throw new RangeError('scale must be positive');
  }
  const viewport = constrainSkyViewport(rawViewport, canvas);
  const previousVerticalSpanDegrees = getVerticalSpanDegrees(viewport, canvas);
  const horizontalSpanDegrees = Math.max(
    MINIMUM_HORIZONTAL_SPAN_DEGREES,
    Math.min(
      MAXIMUM_HORIZONTAL_SPAN_DEGREES,
      viewport.horizontalSpanDegrees / gesture.scale,
    ),
  );
  const nextViewport = {
    ...viewport,
    horizontalSpanDegrees,
  };
  const nextVerticalSpanDegrees = getVerticalSpanDegrees(nextViewport, canvas);
  const horizontalFocalRatio = gesture.focalXPixels / canvas.widthPixels - 0.5;
  const verticalFocalRatio = 0.5 - gesture.focalYPixels / canvas.heightPixels;
  const focalAzimuthDegrees =
    viewport.centerAzimuthDegrees +
    horizontalFocalRatio * viewport.horizontalSpanDegrees;
  const focalAltitudeDegrees =
    viewport.centerAltitudeDegrees +
    verticalFocalRatio * previousVerticalSpanDegrees;
  return constrainSkyViewport(
    {
      centerAzimuthDegrees:
        focalAzimuthDegrees - horizontalFocalRatio * horizontalSpanDegrees,
      centerAltitudeDegrees:
        focalAltitudeDegrees - verticalFocalRatio * nextVerticalSpanDegrees,
      horizontalSpanDegrees,
    },
    canvas,
  );
};

/** Applies a simultaneous pan/pinch sample to one immutable gesture baseline.
 * Keeping this pure prevents incremental scale and translation drift. */
export const applySkyNavigationGesture = (
  viewport: SkyViewport,
  canvas: CanvasSizePixels,
  gesture: SkyNavigationGesture,
) =>
  applySkyPan(applySkyZoom(viewport, canvas, gesture), canvas, {
    translationXPixels: gesture.translationXPixels,
    translationYPixels: gesture.translationYPixels,
  });
