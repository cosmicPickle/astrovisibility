import {
  createCelestialCubeOrientation,
  type CelestialCubeOrientation,
} from './backgroundCube';
import constellationsJson from './generated/constellations.json';
import starsJson from './generated/stars.json';
import {
  createInstantHorizontalProjector,
  type ObserverLocation,
} from '../astronomy/horizontalCoordinates';
import {
  angularSeparationDegrees,
  getPlanetariumCameraCenter,
  horizontalDirectionToVector,
  projectHorizontalDirection,
  type PlanetariumCamera,
  type Vector3,
} from './planetariumProjection';
import type { PlanetariumPanoramaMesh } from './planetariumPanoramaGeometry';
import type {
  CanvasSizePixels,
  HorizontalDirectionDegrees,
} from './projection';
import {
  createEquatorialCutoutMesh,
  type EquatorialDirection,
  type EquatorialImageMesh,
} from './registeredSkyGeometry';

type RegisteredStarRow = readonly [
  id: string,
  rightAscensionJ2000Hours: number,
  declinationJ2000Degrees: number,
  magnitude: number,
  colorIndexBv: number | null,
  properName: string | null,
];

export interface RegisteredConstellation {
  id: string;
  label: EquatorialDirection;
  lines: EquatorialDirection[][];
  name: string;
  rank: number;
}

export interface HorizontalRegisteredStar extends HorizontalDirectionDegrees {
  colorIndexBv?: number;
  id: string;
  magnitude: number;
  unitVector?: Vector3;
}

export interface HorizontalRegisteredConstellation {
  id: string;
  label: HorizontalDirectionDegrees;
  lines: HorizontalDirectionDegrees[][];
  name: string;
  rank: number;
}

export interface RegisteredSkyProjection {
  celestialOrientation?: CelestialCubeOrientation;
  constellations: HorizontalRegisteredConstellation[];
  stars: HorizontalRegisteredStar[];
}

export interface RegisteredStarBatch {
  coreColor: string;
  color: string;
  directions: HorizontalRegisteredStar[];
  fadeStartFieldOfViewDegrees: number | null;
  fullOpacityFieldOfViewDegrees: number | null;
  haloRadiusPixels: number;
  key: string;
  outerHaloRadiusPixels: number | null;
  radiusPixels: number;
}

export interface RegisteredDsoImage {
  mesh: PlanetariumPanoramaMesh;
  source: number;
  targetId: string;
}

export interface RegisteredDsoImageDefinition {
  declinationJ2000Degrees: number;
  fieldOfViewDegrees: number;
  rightAscensionJ2000Hours: number;
  source: number;
  targetId: string;
}

export const MINIMUM_CONSTELLATION_CANVAS_AREA_FRACTION = 0.05;

const stars = starsJson as unknown as RegisteredStarRow[];
const constellations = constellationsJson as RegisteredConstellation[];
const projectMesh = (
  mesh: EquatorialImageMesh,
  project: (coordinate: EquatorialDirection) => {
    azimuthDegreesClockwiseFromNorth: number;
    refractedAltitudeDegrees: number;
  },
): PlanetariumPanoramaMesh => {
  const directions = mesh.directions.map((coordinate) => {
    const horizontal = project(coordinate);
    return {
      altitudeDegrees: horizontal.refractedAltitudeDegrees,
      azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
    };
  });
  const centerDirection = directions[Math.floor(directions.length / 2)]!;
  return {
    angularRadiusDegrees: Math.max(
      ...directions.map((direction) =>
        angularSeparationDegrees(centerDirection, direction),
      ),
    ),
    centerDirection,
    columnCount: mesh.columnCount,
    directions,
    directionVectors: directions.map(horizontalDirectionToVector),
    indices: mesh.indices,
    rowCount: mesh.rowCount,
    texturePointsPixels: mesh.texturePointsPixels,
  };
};

export const createRegisteredSkyProjection = (input: {
  observer: ObserverLocation;
  timestampUtc: string;
}): RegisteredSkyProjection => {
  const project = createInstantHorizontalProjector(input);
  return {
    celestialOrientation: createCelestialCubeOrientation(input),
    constellations: constellations.map((constellation) => ({
      id: constellation.id,
      label: (() => {
        const horizontal = project(constellation.label);
        return {
          altitudeDegrees: horizontal.refractedAltitudeDegrees,
          azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
        };
      })(),
      lines: constellation.lines.map((line) =>
        line.map((coordinate) => {
          const horizontal = project(coordinate);
          return {
            altitudeDegrees: horizontal.refractedAltitudeDegrees,
            azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
          };
        }),
      ),
      name: constellation.name,
      rank: constellation.rank,
    })),
    stars: stars.map((star) => {
      const [
        id,
        rightAscensionJ2000Hours,
        declinationJ2000Degrees,
        magnitude,
        colorIndexBv,
      ] = star;
      const horizontal = project({
        declinationJ2000Degrees,
        rightAscensionJ2000Hours,
      });
      const direction = {
        altitudeDegrees: horizontal.refractedAltitudeDegrees,
        azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
      };
      return {
        ...(colorIndexBv === null ? {} : { colorIndexBv }),
        ...direction,
        id,
        magnitude,
        unitVector: horizontalDirectionToVector(direction),
      };
    }),
  };
};

export const createRegisteredDsoProjection = (input: {
  definitions: readonly RegisteredDsoImageDefinition[];
  observer: ObserverLocation;
  timestampUtc: string;
}): RegisteredDsoImage[] => {
  const project = createInstantHorizontalProjector(input);
  return input.definitions.map((definition) => ({
    mesh: projectMesh(
      createEquatorialCutoutMesh({
        centerDeclinationJ2000Degrees: definition.declinationJ2000Degrees,
        centerRightAscensionJ2000Hours: definition.rightAscensionJ2000Hours,
        fieldOfViewDegrees: definition.fieldOfViewDegrees,
        heightPixels: 256,
        widthPixels: 256,
      }),
      project,
    ),
    source: definition.source,
    targetId: definition.targetId,
  }));
};

export const getRegisteredDsoImageOpacity = (
  angularRadiusDegrees: number,
  cameraFieldOfViewDegrees: number,
  minimumCanvasDimensionPixels: number,
) => {
  'worklet';
  const approximateDiameterPixels =
    ((angularRadiusDegrees * 2) / cameraFieldOfViewDegrees) *
    minimumCanvasDimensionPixels;
  const fadeStartDiameterPixels = 32;
  const fullOpacityDiameterPixels = 96;
  const opacity =
    ((approximateDiameterPixels - fadeStartDiameterPixels) /
      (fullOpacityDiameterPixels - fadeStartDiameterPixels)) *
    0.9;
  return Math.max(0, Math.min(0.9, opacity));
};

const getCameraCornerAngularRadiusDegrees = (
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  const halfMinimumDimensionPixels =
    Math.min(canvas.widthPixels, canvas.heightPixels) / 2;
  const cornerRadiusPixels = Math.hypot(
    canvas.widthPixels / 2,
    canvas.heightPixels / 2,
  );
  return (
    (2 *
      Math.atan(
        (cornerRadiusPixels / Math.max(1, halfMinimumDimensionPixels)) *
          Math.tan((camera.fieldOfViewDegrees * Math.PI) / 720),
      ) *
      180) /
    Math.PI
  );
};

export const selectRegisteredDsoImages = (
  images: readonly RegisteredDsoImage[],
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
  selectedTargetId: string | null,
): RegisteredDsoImage[] => {
  const cameraCenter = getPlanetariumCameraCenter(camera);
  const viewRadiusDegrees = getCameraCornerAngularRadiusDegrees(camera, canvas);
  return images
    .filter(
      ({ mesh }) =>
        getRegisteredDsoImageOpacity(
          mesh.angularRadiusDegrees,
          camera.fieldOfViewDegrees,
          Math.min(canvas.widthPixels, canvas.heightPixels),
        ) > 0 &&
        angularSeparationDegrees(cameraCenter, mesh.centerDirection) <=
          viewRadiusDegrees + mesh.angularRadiusDegrees,
    )
    .sort((left, right) => {
      if (left.targetId === selectedTargetId) return 1;
      if (right.targetId === selectedTargetId) return -1;
      return left.targetId.localeCompare(right.targetId);
    });
};

const MAXIMUM_RENDERED_STAR_MAGNITUDE = 6.7;
const STAR_BAND_PREFETCH_FIELD_OF_VIEW_RATIO = 1.25;

interface RegisteredStarStyle extends Omit<
  RegisteredStarBatch,
  'directions' | 'key'
> {
  styleKey: string;
}

interface RegisteredStarMagnitudeStyle extends Pick<
  RegisteredStarBatch,
  | 'fadeStartFieldOfViewDegrees'
  | 'fullOpacityFieldOfViewDegrees'
  | 'haloRadiusPixels'
  | 'outerHaloRadiusPixels'
  | 'radiusPixels'
> {
  key: string;
  maximumMagnitude: number;
}

const STAR_MAGNITUDE_STYLES: readonly RegisteredStarMagnitudeStyle[] = [
  {
    fadeStartFieldOfViewDegrees: null,
    fullOpacityFieldOfViewDegrees: null,
    haloRadiusPixels: 3.15,
    key: '1',
    maximumMagnitude: 1.5,
    outerHaloRadiusPixels: 5.2,
    radiusPixels: 1.85,
  },
  {
    fadeStartFieldOfViewDegrees: null,
    fullOpacityFieldOfViewDegrees: null,
    haloRadiusPixels: 2.6,
    key: '2',
    maximumMagnitude: 3,
    outerHaloRadiusPixels: 4.2,
    radiusPixels: 1.45,
  },
  {
    fadeStartFieldOfViewDegrees: null,
    fullOpacityFieldOfViewDegrees: null,
    haloRadiusPixels: 2.05,
    key: '3',
    maximumMagnitude: 4,
    outerHaloRadiusPixels: null,
    radiusPixels: 1.1,
  },
  {
    fadeStartFieldOfViewDegrees: 105,
    fullOpacityFieldOfViewDegrees: 65,
    haloRadiusPixels: 1.8,
    key: '4',
    maximumMagnitude: 4.8,
    outerHaloRadiusPixels: null,
    radiusPixels: 0.9,
  },
  {
    fadeStartFieldOfViewDegrees: 70,
    fullOpacityFieldOfViewDegrees: 40,
    haloRadiusPixels: 1.55,
    key: '5',
    maximumMagnitude: 5.5,
    outerHaloRadiusPixels: null,
    radiusPixels: 0.72,
  },
  {
    fadeStartFieldOfViewDegrees: 45,
    fullOpacityFieldOfViewDegrees: 24,
    haloRadiusPixels: 1.4,
    key: '6',
    maximumMagnitude: 6,
    outerHaloRadiusPixels: null,
    radiusPixels: 0.62,
  },
  {
    fadeStartFieldOfViewDegrees: 26,
    fullOpacityFieldOfViewDegrees: 13,
    haloRadiusPixels: 1.3,
    key: '7',
    maximumMagnitude: 6.4,
    outerHaloRadiusPixels: null,
    radiusPixels: 0.56,
  },
  {
    fadeStartFieldOfViewDegrees: 14,
    fullOpacityFieldOfViewDegrees: 7,
    haloRadiusPixels: 1.2,
    key: '8',
    maximumMagnitude: MAXIMUM_RENDERED_STAR_MAGNITUDE,
    outerHaloRadiusPixels: null,
    radiusPixels: 0.5,
  },
];

const getStarColorStyle = (colorIndexBv: number | undefined) => {
  if (colorIndexBv !== undefined && colorIndexBv < 0.2) {
    return { color: '#9fcaff', coreColor: '#f7fbff', key: 'blue' };
  }
  if (colorIndexBv !== undefined && colorIndexBv > 1) {
    return { color: '#ffc88f', coreColor: '#fff9ef', key: 'warm' };
  }
  return { color: '#dce7ff', coreColor: '#ffffff', key: 'neutral' };
};

const getMaximumResidentStarMagnitude = (fieldOfViewDegrees: number) => {
  let maximumMagnitude = STAR_MAGNITUDE_STYLES[0]!.maximumMagnitude;
  for (const style of STAR_MAGNITUDE_STYLES) {
    if (
      style.fadeStartFieldOfViewDegrees !== null &&
      fieldOfViewDegrees >
        style.fadeStartFieldOfViewDegrees *
          STAR_BAND_PREFETCH_FIELD_OF_VIEW_RATIO
    ) {
      break;
    }
    maximumMagnitude = style.maximumMagnitude;
  }
  return maximumMagnitude;
};

const starStyle = (star: HorizontalRegisteredStar): RegisteredStarStyle => {
  const colorStyle = getStarColorStyle(star.colorIndexBv);
  const magnitudeStyle = STAR_MAGNITUDE_STYLES.find(
    ({ maximumMagnitude }) => star.magnitude <= maximumMagnitude,
  )!;
  return {
    color: colorStyle.color,
    coreColor: colorStyle.coreColor,
    fadeStartFieldOfViewDegrees: magnitudeStyle.fadeStartFieldOfViewDegrees,
    fullOpacityFieldOfViewDegrees: magnitudeStyle.fullOpacityFieldOfViewDegrees,
    haloRadiusPixels: magnitudeStyle.haloRadiusPixels,
    outerHaloRadiusPixels: magnitudeStyle.outerHaloRadiusPixels,
    radiusPixels: magnitudeStyle.radiusPixels,
    styleKey: `${colorStyle.key}-${magnitudeStyle.key}`,
  };
};

export const getRegisteredStarBatchOpacity = (
  batch: Pick<
    RegisteredStarBatch,
    'fadeStartFieldOfViewDegrees' | 'fullOpacityFieldOfViewDegrees'
  >,
  cameraFieldOfViewDegrees: number,
) => {
  'worklet';
  const { fadeStartFieldOfViewDegrees, fullOpacityFieldOfViewDegrees } = batch;
  if (
    fadeStartFieldOfViewDegrees === null ||
    fullOpacityFieldOfViewDegrees === null
  ) {
    return 1;
  }
  if (cameraFieldOfViewDegrees >= fadeStartFieldOfViewDegrees) return 0;
  if (cameraFieldOfViewDegrees <= fullOpacityFieldOfViewDegrees) return 1;
  const progress =
    (fadeStartFieldOfViewDegrees - cameraFieldOfViewDegrees) /
    (fadeStartFieldOfViewDegrees - fullOpacityFieldOfViewDegrees);
  return progress * progress * (3 - 2 * progress);
};

export const selectRegisteredStarBatches = (
  projectedStars: readonly HorizontalRegisteredStar[],
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): RegisteredStarBatch[] => {
  const maximumResidentMagnitude = getMaximumResidentStarMagnitude(
    camera.fieldOfViewDegrees,
  );
  const cornerAngularRadiusDegrees = getCameraCornerAngularRadiusDegrees(
    camera,
    canvas,
  );
  const residentRadiusDegrees = Math.min(
    180,
    cornerAngularRadiusDegrees + camera.fieldOfViewDegrees * 0.15,
  );
  const minimumResidentDotProduct = Math.cos(
    (residentRadiusDegrees * Math.PI) / 180,
  );
  const batches = new Map<string, RegisteredStarBatch>();
  for (const star of projectedStars) {
    if (star.magnitude > maximumResidentMagnitude) {
      continue;
    }
    const style = starStyle(star);
    const starVector = star.unitVector ?? horizontalDirectionToVector(star);
    const centerDotProduct =
      starVector.x * camera.forward.x +
      starVector.y * camera.forward.y +
      starVector.z * camera.forward.z;
    if (
      residentRadiusDegrees < 180 &&
      centerDotProduct < minimumResidentDotProduct
    ) {
      continue;
    }
    const { styleKey: key, ...batchStyle } = style;
    const batch = batches.get(key) ?? {
      ...batchStyle,
      directions: [],
      key,
    };
    batch.directions.push(star);
    batches.set(key, batch);
  }
  return [...batches.values()];
};

export const selectRegisteredConstellationLabels = (
  projectedConstellations: readonly HorizontalRegisteredConstellation[],
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): HorizontalRegisteredConstellation[] => {
  const maximumRank =
    camera.fieldOfViewDegrees >= 100
      ? 1
      : camera.fieldOfViewDegrees >= 45
        ? 2
        : 3;
  const occupied: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  }[] = [];
  const selected: HorizontalRegisteredConstellation[] = [];
  for (const constellation of [...projectedConstellations].sort(
    (left, right) =>
      left.rank === right.rank
        ? left.id.localeCompare(right.id)
        : left.rank - right.rank,
  )) {
    if (constellation.rank > maximumRank) continue;
    const point = projectHorizontalDirection(
      constellation.label,
      camera,
      canvas,
    );
    if (!point.visible) continue;
    const width = Math.max(36, constellation.name.length * 6.5);
    const bounds = {
      bottom: point.yPixels + 9,
      left: point.xPixels - width / 2,
      right: point.xPixels + width / 2,
      top: point.yPixels - 9,
    };
    if (
      bounds.left < 0 ||
      bounds.right > canvas.widthPixels ||
      bounds.top < 0 ||
      bounds.bottom > canvas.heightPixels ||
      occupied.some(
        (other) =>
          bounds.left < other.right &&
          bounds.right > other.left &&
          bounds.top < other.bottom &&
          bounds.bottom > other.top,
      )
    ) {
      continue;
    }
    occupied.push(bounds);
    selected.push(constellation);
    if (selected.length >= 18) break;
  }
  return selected;
};

export const selectVisibleRegisteredConstellations = (
  projectedConstellations: readonly HorizontalRegisteredConstellation[],
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): HorizontalRegisteredConstellation[] => {
  const canvasAreaPixels = canvas.widthPixels * canvas.heightPixels;
  if (canvasAreaPixels <= 0) return [];
  return projectedConstellations.filter((constellation) => {
    let pointCount = 0;
    let minimumXPixels = Number.POSITIVE_INFINITY;
    let maximumXPixels = Number.NEGATIVE_INFINITY;
    let minimumYPixels = Number.POSITIVE_INFINITY;
    let maximumYPixels = Number.NEGATIVE_INFINITY;
    for (const line of constellation.lines) {
      for (const direction of line) {
        const point = projectHorizontalDirection(direction, camera, canvas);
        if (!point.visible) return false;
        pointCount += 1;
        minimumXPixels = Math.min(minimumXPixels, point.xPixels);
        maximumXPixels = Math.max(maximumXPixels, point.xPixels);
        minimumYPixels = Math.min(minimumYPixels, point.yPixels);
        maximumYPixels = Math.max(maximumYPixels, point.yPixels);
      }
    }
    if (pointCount === 0) return false;
    const widthPixels = maximumXPixels - minimumXPixels;
    const heightPixels = maximumYPixels - minimumYPixels;
    return (
      (widthPixels * heightPixels) / canvasAreaPixels >=
      MINIMUM_CONSTELLATION_CANVAS_AREA_FRACTION
    );
  });
};
