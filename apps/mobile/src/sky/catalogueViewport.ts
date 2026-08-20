import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type { CanvasSizePixels } from './projection';
import {
  getVerticalSpanDegrees,
  projectDirectionToViewport,
  type SkyViewport,
} from './skyViewport';
import {
  getPlanetariumCameraCenter,
  horizontalDirectionToVector,
  projectHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';

const BIN_SIZE_DEGREES = 10;
const AZIMUTH_BIN_COUNT = 360 / BIN_SIZE_DEGREES;
const MAXIMUM_RENDERED_TARGETS = 120;
const MINIMUM_HIT_RADIUS_PIXELS = 22;
const PLANETARIUM_OVERSCAN_RATIO = 0.25;
const PLANETARIUM_CATALOGUE_REFRESH_PAN_RATIO = 0.15;
const PLANETARIUM_CATALOGUE_REFRESH_ZOOM_RATIO = 1.15;

export interface HorizontalCatalogueTarget {
  altitudeDegrees: number;
  azimuthDegrees: number;
  target: CatalogueTarget;
}

export interface HorizontalSpatialIndex {
  bins: ReadonlyMap<string, readonly HorizontalCatalogueTarget[]>;
  targetCount: number;
}

export interface ViewportCatalogueTarget extends HorizontalCatalogueTarget {
  hitRadiusPixels: number;
  label: string;
  labelVisible: boolean;
  outlineHeightPixels: number;
  outlineRotationDegrees: number;
  outlineWidthPixels: number;
  secondaryLabel?: string;
  xPixels: number;
  yPixels: number;
}

export const shouldRefreshPlanetariumCatalogue = (
  anchorCamera: PlanetariumCamera,
  liveCamera: PlanetariumCamera,
): boolean => {
  const anchorDirection = horizontalDirectionToVector(
    getPlanetariumCameraCenter(anchorCamera),
  );
  const liveDirection = horizontalDirectionToVector(
    getPlanetariumCameraCenter(liveCamera),
  );
  const directionCosine = Math.max(
    -1,
    Math.min(
      1,
      anchorDirection.x * liveDirection.x +
        anchorDirection.y * liveDirection.y +
        anchorDirection.z * liveDirection.z,
    ),
  );
  const separationDegrees = (Math.acos(directionCosine) * 180) / Math.PI;
  const smallerFieldOfViewDegrees = Math.min(
    anchorCamera.fieldOfViewDegrees,
    liveCamera.fieldOfViewDegrees,
  );
  const zoomRatio =
    Math.max(anchorCamera.fieldOfViewDegrees, liveCamera.fieldOfViewDegrees) /
    smallerFieldOfViewDegrees;

  return (
    separationDegrees >=
      smallerFieldOfViewDegrees * PLANETARIUM_CATALOGUE_REFRESH_PAN_RATIO ||
    zoomRatio >= PLANETARIUM_CATALOGUE_REFRESH_ZOOM_RATIO
  );
};

export const getSecondaryCatalogueLabel = (target: CatalogueTarget) => {
  const membershipLabels = [
    ...target.memberships.messier.map((number) => `M ${number}`),
    ...(target.memberships.caldwell === undefined
      ? []
      : [`C ${target.memberships.caldwell}`]),
    ...target.memberships.ngc,
    ...target.memberships.ic,
  ];
  return (
    membershipLabels.find((label) => label !== target.preferredName) ??
    target.aliases
      .filter(
        (alias) =>
          alias !== target.preferredName && /^(?:M|C|NGC|IC)\s?\d/i.test(alias),
      )
      .sort((left, right) => left.length - right.length)[0]
  );
};

const azimuthBin = (azimuthDegrees: number) => {
  const normalized = ((azimuthDegrees % 360) + 360) % 360;
  return Math.min(
    AZIMUTH_BIN_COUNT - 1,
    Math.floor(normalized / BIN_SIZE_DEGREES),
  );
};

const altitudeBin = (altitudeDegrees: number) =>
  Math.max(0, Math.min(8, Math.floor(altitudeDegrees / BIN_SIZE_DEGREES)));

const binKey = (azimuthIndex: number, altitudeIndex: number) =>
  `${azimuthIndex}:${altitudeIndex}`;

export const buildHorizontalSpatialIndex = (
  targets: readonly HorizontalCatalogueTarget[],
): HorizontalSpatialIndex => {
  const mutableBins = new Map<string, HorizontalCatalogueTarget[]>();
  for (const target of targets) {
    if (
      !Number.isFinite(target.azimuthDegrees) ||
      !Number.isFinite(target.altitudeDegrees) ||
      target.altitudeDegrees < 0 ||
      target.altitudeDegrees > 90
    ) {
      continue;
    }
    const key = binKey(
      azimuthBin(target.azimuthDegrees),
      altitudeBin(target.altitudeDegrees),
    );
    const bin = mutableBins.get(key) ?? [];
    bin.push(target);
    mutableBins.set(key, bin);
  }
  return { bins: mutableBins, targetCount: targets.length };
};

export const getProminenceTierLimit = (
  horizontalSpanDegrees: number,
): 1 | 2 | 3 | 4 => {
  if (horizontalSpanDegrees > 220) return 1;
  if (horizontalSpanDegrees > 100) return 2;
  if (horizontalSpanDegrees > 45) return 3;
  return 4;
};

const queryBins = (
  index: HorizontalSpatialIndex,
  viewport: SkyViewport,
  canvas: CanvasSizePixels,
  prominenceTierLimit: 1 | 2 | 3 | 4,
  overscanRatio: number,
) => {
  const verticalSpanDegrees = getVerticalSpanDegrees(viewport, canvas);
  const spanMultiplier = 1 + overscanRatio * 2;
  const minimumAzimuth =
    viewport.centerAzimuthDegrees -
    (viewport.horizontalSpanDegrees / 2) * spanMultiplier;
  const maximumAzimuth =
    viewport.centerAzimuthDegrees +
    (viewport.horizontalSpanDegrees / 2) * spanMultiplier;
  const minimumAltitude = Math.max(
    0,
    viewport.centerAltitudeDegrees - (verticalSpanDegrees / 2) * spanMultiplier,
  );
  const maximumAltitude = Math.min(
    90,
    viewport.centerAltitudeDegrees + (verticalSpanDegrees / 2) * spanMultiplier,
  );
  const candidates = new Map<string, HorizontalCatalogueTarget>();
  for (
    let unwrappedAzimuthBin = Math.floor(minimumAzimuth / BIN_SIZE_DEGREES);
    unwrappedAzimuthBin <= Math.floor(maximumAzimuth / BIN_SIZE_DEGREES);
    unwrappedAzimuthBin += 1
  ) {
    const wrappedAzimuthBin =
      ((unwrappedAzimuthBin % AZIMUTH_BIN_COUNT) + AZIMUTH_BIN_COUNT) %
      AZIMUTH_BIN_COUNT;
    for (
      let currentAltitudeBin = altitudeBin(minimumAltitude);
      currentAltitudeBin <= altitudeBin(maximumAltitude);
      currentAltitudeBin += 1
    ) {
      for (const target of index.bins.get(
        binKey(wrappedAzimuthBin, currentAltitudeBin),
      ) ?? []) {
        if (target.target.prominenceTier <= prominenceTierLimit) {
          candidates.set(target.target.id, target);
        }
      }
    }
  }
  return [...candidates.values()];
};

const overlaps = (
  left: { left: number; right: number; top: number; bottom: number },
  right: { left: number; right: number; top: number; bottom: number },
) =>
  left.left < right.right &&
  left.right > right.left &&
  left.top < right.bottom &&
  left.bottom > right.top;

export const queryCatalogueViewport = (
  index: HorizontalSpatialIndex,
  viewport: SkyViewport,
  canvas: CanvasSizePixels,
  options: { overscanRatio?: number } = {},
): ViewportCatalogueTarget[] => {
  const overscanRatio = Math.max(0, options.overscanRatio ?? 0);
  const prominenceTierLimit = getProminenceTierLimit(
    viewport.horizontalSpanDegrees,
  );
  const verticalSpanDegrees = getVerticalSpanDegrees(viewport, canvas);
  const horizontalPixelsPerDegree =
    canvas.widthPixels / viewport.horizontalSpanDegrees;
  const verticalPixelsPerDegree = canvas.heightPixels / verticalSpanDegrees;
  const occupiedLabels: Array<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  }> = [];
  const visible: ViewportCatalogueTarget[] = [];
  const candidates = queryBins(
    index,
    viewport,
    canvas,
    prominenceTierLimit,
    overscanRatio,
  ).sort(
    (left, right) =>
      left.target.prominenceTier - right.target.prominenceTier ||
      (left.target.magnitude ?? Number.POSITIVE_INFINITY) -
        (right.target.magnitude ?? Number.POSITIVE_INFINITY) ||
      left.target.preferredName.localeCompare(right.target.preferredName, 'en'),
  );

  for (const item of candidates) {
    const point = projectDirectionToViewport(
      {
        altitudeDegrees: item.altitudeDegrees,
        azimuthDegrees: item.azimuthDegrees,
      },
      viewport,
      canvas,
      { overscanRatio },
    );
    if (!point) continue;
    const secondaryLabel = getSecondaryCatalogueLabel(item.target);
    const labelWidthPixels = Math.min(
      180,
      Math.max(
        44,
        item.target.preferredName.length * 7.8,
        (secondaryLabel?.length ?? 0) * 6.4,
      ),
    );
    const labelBounds = {
      left: point.xPixels - labelWidthPixels / 2,
      right: point.xPixels + labelWidthPixels / 2,
      top: point.yPixels - MINIMUM_HIT_RADIUS_PIXELS,
      bottom: point.yPixels + MINIMUM_HIT_RADIUS_PIXELS + 28,
    };
    const labelVisible =
      labelBounds.left >= 4 &&
      labelBounds.right <= canvas.widthPixels - 4 &&
      labelBounds.top >= 4 &&
      labelBounds.bottom <= canvas.heightPixels - 4;
    if (
      labelBounds.left < -canvas.widthPixels * overscanRatio + 4 ||
      labelBounds.right > canvas.widthPixels * (1 + overscanRatio) - 4 ||
      labelBounds.top < -canvas.heightPixels * overscanRatio + 4 ||
      labelBounds.bottom > canvas.heightPixels * (1 + overscanRatio) - 4 ||
      (labelVisible &&
        occupiedLabels.some((bounds) => overlaps(bounds, labelBounds)))
    ) {
      continue;
    }
    const majorAxisDegrees = (item.target.majorAxisArcminutes ?? 3) / 60;
    const minorAxisDegrees =
      (item.target.minorAxisArcminutes ??
        item.target.majorAxisArcminutes ??
        3) / 60;
    if (labelVisible) occupiedLabels.push(labelBounds);
    visible.push({
      ...item,
      ...point,
      hitRadiusPixels: MINIMUM_HIT_RADIUS_PIXELS,
      label: item.target.preferredName,
      labelVisible,
      outlineWidthPixels: Math.max(
        2,
        majorAxisDegrees * horizontalPixelsPerDegree,
      ),
      outlineHeightPixels: Math.max(
        2,
        minorAxisDegrees * verticalPixelsPerDegree,
      ),
      outlineRotationDegrees: 90 - (item.target.positionAngleDegrees ?? 0),
      ...(secondaryLabel ? { secondaryLabel } : {}),
    });
    if (visible.length >= MAXIMUM_RENDERED_TARGETS) break;
  }
  return visible;
};

export const queryCataloguePlanetarium = (
  targets: readonly HorizontalCatalogueTarget[],
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): ViewportCatalogueTarget[] => {
  const prominenceTierLimit = getProminenceTierLimit(camera.fieldOfViewDegrees);
  const center = getPlanetariumCameraCenter(camera);
  const bufferedAngularRadiusDegrees = Math.min(
    180,
    camera.fieldOfViewDegrees * 1.5,
  );
  const centerVector = horizontalDirectionToVector(center);
  const minimumDirectionCosine = Math.cos(
    (bufferedAngularRadiusDegrees * Math.PI) / 180,
  );
  const occupiedLabels: Array<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  }> = [];
  const pixelsPerDegree =
    Math.min(canvas.widthPixels, canvas.heightPixels) /
    camera.fieldOfViewDegrees;
  const candidates = targets
    .filter((item) => {
      if (item.altitudeDegrees < 0) return false;
      if (item.target.prominenceTier > prominenceTierLimit) return false;
      const direction = horizontalDirectionToVector(item);
      return (
        centerVector.x * direction.x +
          centerVector.y * direction.y +
          centerVector.z * direction.z >=
        minimumDirectionCosine
      );
    })
    .sort(
      (left, right) =>
        left.target.prominenceTier - right.target.prominenceTier ||
        (left.target.magnitude ?? Number.POSITIVE_INFINITY) -
          (right.target.magnitude ?? Number.POSITIVE_INFINITY) ||
        left.target.preferredName.localeCompare(
          right.target.preferredName,
          'en',
        ),
    );
  const selected: ViewportCatalogueTarget[] = [];
  for (const item of candidates) {
    const point = projectHorizontalDirection(item, camera, canvas);
    const withinOverscan =
      point.xPixels >= -canvas.widthPixels * PLANETARIUM_OVERSCAN_RATIO &&
      point.xPixels <= canvas.widthPixels * (1 + PLANETARIUM_OVERSCAN_RATIO) &&
      point.yPixels >= -canvas.heightPixels * PLANETARIUM_OVERSCAN_RATIO &&
      point.yPixels <= canvas.heightPixels * (1 + PLANETARIUM_OVERSCAN_RATIO);
    if (!withinOverscan) continue;
    const secondaryLabel = getSecondaryCatalogueLabel(item.target);
    const labelWidthPixels = Math.min(
      180,
      Math.max(
        44,
        item.target.preferredName.length * 7.8,
        (secondaryLabel?.length ?? 0) * 6.4,
      ),
    );
    const labelBounds = {
      left: point.xPixels - labelWidthPixels / 2,
      right: point.xPixels + labelWidthPixels / 2,
      top: point.yPixels - MINIMUM_HIT_RADIUS_PIXELS,
      bottom: point.yPixels + MINIMUM_HIT_RADIUS_PIXELS + 28,
    };
    const labelVisible =
      point.visible &&
      labelBounds.left >= 4 &&
      labelBounds.right <= canvas.widthPixels - 4 &&
      labelBounds.top >= 4 &&
      labelBounds.bottom <= canvas.heightPixels - 4 &&
      !occupiedLabels.some((bounds) => overlaps(bounds, labelBounds));
    if (labelVisible) occupiedLabels.push(labelBounds);
    const majorAxisDegrees = (item.target.majorAxisArcminutes ?? 3) / 60;
    const minorAxisDegrees =
      (item.target.minorAxisArcminutes ??
        item.target.majorAxisArcminutes ??
        3) / 60;
    selected.push({
      ...item,
      xPixels: point.xPixels,
      yPixels: point.yPixels,
      hitRadiusPixels: MINIMUM_HIT_RADIUS_PIXELS,
      label: item.target.preferredName,
      labelVisible,
      outlineHeightPixels: Math.max(2, minorAxisDegrees * pixelsPerDegree),
      outlineRotationDegrees: 90 - (item.target.positionAngleDegrees ?? 0),
      outlineWidthPixels: Math.max(2, majorAxisDegrees * pixelsPerDegree),
      ...(secondaryLabel ? { secondaryLabel } : {}),
    });
    if (selected.length >= MAXIMUM_RENDERED_TARGETS) break;
  }
  return selected;
};
