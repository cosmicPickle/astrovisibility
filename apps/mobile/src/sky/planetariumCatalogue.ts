import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type { CanvasSizePixels } from './projection';
import {
  angularSeparationDegrees,
  angularSizeDegreesToPixelsAtDirection,
  getPlanetariumCameraCenter,
  projectHorizontalDirection,
  unprojectCanvasPoint,
  type PlanetariumCamera,
} from './planetariumProjection';

const BIN_SIZE_DEGREES = 10;
const AZIMUTH_BIN_COUNT = 360 / BIN_SIZE_DEGREES;
const ALTITUDE_BIN_COUNT = 90 / BIN_SIZE_DEGREES;
const BIN_ANGULAR_GUARD_DEGREES = Math.SQRT2 * (BIN_SIZE_DEGREES / 2);
const MAXIMUM_RESIDENT_TARGETS = 480;
const MAXIMUM_VISIBLE_TARGETS = 320;
const MINIMUM_ATLAS_MINOR_AXIS_PIXELS = 2;
const MINIMUM_HIT_RADIUS_PIXELS = 22;
const RESIDENT_SCREEN_OVERSCAN_RATIO = 1;
const RESIDENT_REFRESH_PAN_RATIO = 0.3;
const RESIDENT_REFRESH_ZOOM_RATIO = 1.25;
const LABEL_EDGE_INSET_PIXELS = 4;
const LABEL_TOP_EXTENT_PIXELS = MINIMUM_HIT_RADIUS_PIXELS;
const LABEL_BOTTOM_EXTENT_PIXELS = MINIMUM_HIT_RADIUS_PIXELS + 28;

export interface HorizontalCatalogueTarget {
  altitudeDegrees: number;
  azimuthDegrees: number;
  target: CatalogueTarget;
}

interface PlanetariumCatalogueBin {
  centerAltitudeDegrees: number;
  centerAzimuthDegrees: number;
  key: string;
  targets: readonly HorizontalCatalogueTarget[];
}

export interface PlanetariumCatalogueIndex {
  bins: readonly PlanetariumCatalogueBin[];
  targetById: ReadonlyMap<string, HorizontalCatalogueTarget>;
  targetCount: number;
}

export interface RenderedPlanetariumTarget extends HorizontalCatalogueTarget {
  hitRadiusPixels: number;
  label: string;
  labelVisible: boolean;
  secondaryLabel?: string;
}

export const isPlanetariumLabelFullyInsideCanvas = (
  point: { xPixels: number; yPixels: number },
  labelWidthPixels: number,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  return (
    point.xPixels - labelWidthPixels / 2 >= LABEL_EDGE_INSET_PIXELS &&
    point.xPixels + labelWidthPixels / 2 <=
      canvas.widthPixels - LABEL_EDGE_INSET_PIXELS &&
    point.yPixels - LABEL_TOP_EXTENT_PIXELS >= LABEL_EDGE_INSET_PIXELS &&
    point.yPixels + LABEL_BOTTOM_EXTENT_PIXELS <=
      canvas.heightPixels - LABEL_EDGE_INSET_PIXELS
  );
};

const compareTargets = (
  left: HorizontalCatalogueTarget,
  right: HorizontalCatalogueTarget,
) =>
  left.target.prominenceTier - right.target.prominenceTier ||
  (left.target.magnitude ?? Number.POSITIVE_INFINITY) -
    (right.target.magnitude ?? Number.POSITIVE_INFINITY) ||
  left.target.preferredName.localeCompare(right.target.preferredName, 'en') ||
  left.target.id.localeCompare(right.target.id, 'en');

const normalizeAzimuthDegrees = (azimuthDegrees: number) =>
  ((azimuthDegrees % 360) + 360) % 360;

const getAzimuthBin = (azimuthDegrees: number) =>
  Math.min(
    AZIMUTH_BIN_COUNT - 1,
    Math.floor(normalizeAzimuthDegrees(azimuthDegrees) / BIN_SIZE_DEGREES),
  );

const getAltitudeBin = (altitudeDegrees: number) =>
  Math.min(
    ALTITUDE_BIN_COUNT - 1,
    Math.max(0, Math.floor(altitudeDegrees / BIN_SIZE_DEGREES)),
  );

const getBinKey = (azimuthIndex: number, altitudeIndex: number) =>
  `${azimuthIndex}:${altitudeIndex}`;

export const getPlanetariumProminenceTierLimit = (
  fieldOfViewDegrees: number,
): 1 | 2 | 3 | 4 => {
  if (fieldOfViewDegrees > 220) return 1;
  if (fieldOfViewDegrees > 100) return 2;
  if (fieldOfViewDegrees > 45) return 3;
  return 4;
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

export function buildPlanetariumCatalogueIndex(
  targets: readonly HorizontalCatalogueTarget[],
): PlanetariumCatalogueIndex {
  const mutableBins = new Map<string, HorizontalCatalogueTarget[]>();
  const targetById = new Map<string, HorizontalCatalogueTarget>();

  for (const target of targets) {
    if (
      !Number.isFinite(target.azimuthDegrees) ||
      !Number.isFinite(target.altitudeDegrees) ||
      target.altitudeDegrees < -90 ||
      target.altitudeDegrees > 90
    ) {
      continue;
    }
    targetById.set(target.target.id, target);
    if (target.altitudeDegrees < 0) continue;

    const azimuthIndex = getAzimuthBin(target.azimuthDegrees);
    const altitudeIndex = getAltitudeBin(target.altitudeDegrees);
    const key = getBinKey(azimuthIndex, altitudeIndex);
    const bin = mutableBins.get(key) ?? [];
    bin.push(target);
    mutableBins.set(key, bin);
  }

  const bins = [...mutableBins.entries()]
    .map(([key, binTargets]) => {
      const [azimuthIndexText, altitudeIndexText] = key.split(':');
      const azimuthIndex = Number(azimuthIndexText);
      const altitudeIndex = Number(altitudeIndexText);
      return {
        centerAltitudeDegrees:
          altitudeIndex * BIN_SIZE_DEGREES + BIN_SIZE_DEGREES / 2,
        centerAzimuthDegrees:
          azimuthIndex * BIN_SIZE_DEGREES + BIN_SIZE_DEGREES / 2,
        key,
        targets: [...binTargets].sort(compareTargets),
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key, 'en'));

  return { bins, targetById, targetCount: targetById.size };
}

export function shouldRefreshPlanetariumResidentCatalogue(
  anchorCamera: PlanetariumCamera,
  liveCamera: PlanetariumCamera,
): boolean {
  const separationDegrees = angularSeparationDegrees(
    getPlanetariumCameraCenter(anchorCamera),
    getPlanetariumCameraCenter(liveCamera),
  );
  const smallerFieldOfViewDegrees = Math.min(
    anchorCamera.fieldOfViewDegrees,
    liveCamera.fieldOfViewDegrees,
  );
  const zoomRatio =
    Math.max(anchorCamera.fieldOfViewDegrees, liveCamera.fieldOfViewDegrees) /
    smallerFieldOfViewDegrees;
  return (
    separationDegrees >=
      smallerFieldOfViewDegrees * RESIDENT_REFRESH_PAN_RATIO ||
    zoomRatio >= RESIDENT_REFRESH_ZOOM_RATIO
  );
}

const getResidentAngularRadiusDegrees = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  const center = getPlanetariumCameraCenter(camera);
  const corners = [
    { xPixels: 0, yPixels: 0 },
    { xPixels: canvas.widthPixels, yPixels: 0 },
    { xPixels: canvas.widthPixels, yPixels: canvas.heightPixels },
    { xPixels: 0, yPixels: canvas.heightPixels },
  ];
  let visibleRadiusDegrees = camera.fieldOfViewDegrees / 2;
  for (const corner of corners) {
    const cornerDirection = unprojectCanvasPoint(corner, camera, canvas);
    if (cornerDirection) {
      visibleRadiusDegrees = Math.max(
        visibleRadiusDegrees,
        angularSeparationDegrees(center, cornerDirection),
      );
    }
  }
  return Math.min(
    180,
    visibleRadiusDegrees + Math.max(15, camera.fieldOfViewDegrees * 0.4),
  );
};

const isInsideBounds = (
  point: { xPixels: number; yPixels: number },
  canvas: CanvasSizePixels,
  overscanRatio: number,
) =>
  point.xPixels >= -canvas.widthPixels * overscanRatio &&
  point.xPixels <= canvas.widthPixels * (1 + overscanRatio) &&
  point.yPixels >= -canvas.heightPixels * overscanRatio &&
  point.yPixels <= canvas.heightPixels * (1 + overscanRatio);

const isKnownTargetReadableAtZoom = (
  target: HorizontalCatalogueTarget,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  const minorAxisArcminutes =
    target.target.minorAxisArcminutes ?? target.target.majorAxisArcminutes;
  if (minorAxisArcminutes === undefined) return true;
  const projectedMinorAxisPixels = angularSizeDegreesToPixelsAtDirection(
    minorAxisArcminutes / 60,
    getPlanetariumCameraCenter(camera),
    camera,
    canvas,
  );
  return projectedMinorAxisPixels >= MINIMUM_ATLAS_MINOR_AXIS_PIXELS;
};

const takeSpatiallyFair = (
  groups: readonly (readonly HorizontalCatalogueTarget[])[],
  limit: number,
) => {
  const selected: HorizontalCatalogueTarget[] = [];
  for (let rank = 0; selected.length < limit; rank += 1) {
    let added = false;
    for (const group of groups) {
      const target = group[rank];
      if (!target) continue;
      selected.push(target);
      added = true;
      if (selected.length >= limit) break;
    }
    if (!added) break;
  }
  return selected;
};

export function selectPlanetariumResidentTargets(
  index: PlanetariumCatalogueIndex,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
  options: { selectedTargetId?: string | null } = {},
): HorizontalCatalogueTarget[] {
  const center = getPlanetariumCameraCenter(camera);
  const residentRadiusDegrees = getResidentAngularRadiusDegrees(camera, canvas);
  const prominenceTierLimit = getPlanetariumProminenceTierLimit(
    camera.fieldOfViewDegrees,
  );
  const selectedTargetId = options.selectedTargetId ?? null;
  const visibleGroups: HorizontalCatalogueTarget[][] = [];
  const guardGroups: HorizontalCatalogueTarget[][] = [];

  for (const bin of index.bins) {
    if (
      angularSeparationDegrees(center, {
        altitudeDegrees: bin.centerAltitudeDegrees,
        azimuthDegrees: bin.centerAzimuthDegrees,
      }) >
      residentRadiusDegrees + BIN_ANGULAR_GUARD_DEGREES
    ) {
      continue;
    }
    const visible: HorizontalCatalogueTarget[] = [];
    const guard: HorizontalCatalogueTarget[] = [];
    for (const item of bin.targets) {
      const selected = item.target.id === selectedTargetId;
      if (
        !selected &&
        (item.target.prominenceTier > prominenceTierLimit ||
          !isKnownTargetReadableAtZoom(item, camera, canvas))
      ) {
        continue;
      }
      const point = projectHorizontalDirection(item, camera, canvas);
      if (!isInsideBounds(point, canvas, RESIDENT_SCREEN_OVERSCAN_RATIO)) {
        continue;
      }
      if (isInsideBounds(point, canvas, 0)) visible.push(item);
      else guard.push(item);
    }
    if (visible.length > 0) visibleGroups.push(visible);
    if (guard.length > 0) guardGroups.push(guard);
  }

  const visible = takeSpatiallyFair(visibleGroups, MAXIMUM_VISIBLE_TARGETS);
  const visibleIds = new Set(visible.map((item) => item.target.id));
  const guard = takeSpatiallyFair(
    guardGroups.map((group) =>
      group.filter((item) => !visibleIds.has(item.target.id)),
    ),
    MAXIMUM_RESIDENT_TARGETS - visible.length,
  );
  const residents = [...visible, ...guard];
  const residentIds = new Set(residents.map((item) => item.target.id));

  if (selectedTargetId && !residentIds.has(selectedTargetId)) {
    const selected = index.targetById.get(selectedTargetId);
    if (selected) residents.push(selected);
  }
  return residents;
}

const overlaps = (
  left: { left: number; right: number; top: number; bottom: number },
  right: { left: number; right: number; top: number; bottom: number },
) =>
  left.left < right.right &&
  left.right > right.left &&
  left.top < right.bottom &&
  left.bottom > right.top;

export function layoutPlanetariumTargetLabels(
  residents: readonly HorizontalCatalogueTarget[],
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
  options: { selectedTargetId?: string | null } = {},
): RenderedPlanetariumTarget[] {
  const selectedTargetId = options.selectedTargetId ?? null;
  const occupiedLabels: Array<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  }> = [];
  const labelVisibility = new Map<string, boolean>();
  const sorted = [...residents].sort((left, right) => {
    if (left.target.id === selectedTargetId) return -1;
    if (right.target.id === selectedTargetId) return 1;
    return compareTargets(left, right);
  });

  for (const item of sorted) {
    const point = projectHorizontalDirection(item, camera, canvas);
    const secondaryLabel = getSecondaryCatalogueLabel(item.target);
    const labelWidthPixels = Math.min(
      180,
      Math.max(
        44,
        item.target.preferredName.length * 7.8,
        (secondaryLabel?.length ?? 0) * 6.4,
      ),
    );
    const bounds = {
      left: point.xPixels - labelWidthPixels / 2,
      right: point.xPixels + labelWidthPixels / 2,
      top: point.yPixels - MINIMUM_HIT_RADIUS_PIXELS,
      bottom: point.yPixels + MINIMUM_HIT_RADIUS_PIXELS + 28,
    };
    const labelVisible =
      isInsideBounds(point, canvas, RESIDENT_SCREEN_OVERSCAN_RATIO) &&
      bounds.left >= -canvas.widthPixels * RESIDENT_SCREEN_OVERSCAN_RATIO + 4 &&
      bounds.right <=
        canvas.widthPixels * (1 + RESIDENT_SCREEN_OVERSCAN_RATIO) - 4 &&
      bounds.top >= -canvas.heightPixels * RESIDENT_SCREEN_OVERSCAN_RATIO + 4 &&
      bounds.bottom <=
        canvas.heightPixels * (1 + RESIDENT_SCREEN_OVERSCAN_RATIO) - 4 &&
      !occupiedLabels.some((occupied) => overlaps(occupied, bounds));
    labelVisibility.set(item.target.id, labelVisible);
    if (labelVisible) occupiedLabels.push(bounds);
  }

  return residents.map((item) => {
    const secondaryLabel = getSecondaryCatalogueLabel(item.target);
    return {
      ...item,
      hitRadiusPixels: MINIMUM_HIT_RADIUS_PIXELS,
      label: item.target.preferredName,
      labelVisible: labelVisibility.get(item.target.id) ?? false,
      ...(secondaryLabel ? { secondaryLabel } : {}),
    };
  });
}
