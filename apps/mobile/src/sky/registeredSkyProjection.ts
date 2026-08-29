import constellationsJson from './generated/constellations.json';
import starsJson from './generated/stars.json';
import {
  createInstantHorizontalProjector,
  type ObserverLocation,
} from '../astronomy/horizontalCoordinates';
import {
  angularSeparationDegrees,
  getPlanetariumCameraCenter,
  projectHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';
import type { PlanetariumPanoramaMesh } from './planetariumPanoramaGeometry';
import type {
  CanvasSizePixels,
  HorizontalDirectionDegrees,
} from './projection';
import {
  createEquatorialAtlasTiles,
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
}

export interface HorizontalRegisteredConstellation {
  id: string;
  label: HorizontalDirectionDegrees;
  lines: HorizontalDirectionDegrees[][];
  name: string;
  rank: number;
}

export interface RegisteredSkyProjection {
  atlasMeshes: PlanetariumPanoramaMesh[];
  constellations: HorizontalRegisteredConstellation[];
  stars: HorizontalRegisteredStar[];
}

export interface RegisteredStarBatch {
  color: string;
  directions: HorizontalDirectionDegrees[];
  key: string;
  radiusPixels: number;
}

const stars = starsJson as unknown as RegisteredStarRow[];
const constellations = constellationsJson as RegisteredConstellation[];
const equatorialAtlasTiles = createEquatorialAtlasTiles({
  heightPixels: 1024,
  widthPixels: 2048,
});

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
    atlasMeshes: equatorialAtlasTiles.map((mesh) => projectMesh(mesh, project)),
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
      return {
        ...(colorIndexBv === null ? {} : { colorIndexBv }),
        altitudeDegrees: horizontal.refractedAltitudeDegrees,
        azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
        id,
        magnitude,
      };
    }),
  };
};

export const createRegisteredDsoMesh = (input: {
  centerDeclinationJ2000Degrees: number;
  centerRightAscensionJ2000Hours: number;
  fieldOfViewDegrees: number;
  observer: ObserverLocation;
  timestampUtc: string;
}): PlanetariumPanoramaMesh =>
  projectMesh(
    createEquatorialCutoutMesh({
      centerDeclinationJ2000Degrees: input.centerDeclinationJ2000Degrees,
      centerRightAscensionJ2000Hours: input.centerRightAscensionJ2000Hours,
      fieldOfViewDegrees: input.fieldOfViewDegrees,
      heightPixels: 256,
      widthPixels: 256,
    }),
    createInstantHorizontalProjector(input),
  );

export const getSelectedDsoImageOpacity = (
  angularRadiusDegrees: number,
  cameraFieldOfViewDegrees: number,
) => {
  'worklet';
  const fadeStartFieldOfViewDegrees = Math.max(24, angularRadiusDegrees * 8);
  const opacity =
    ((fadeStartFieldOfViewDegrees - cameraFieldOfViewDegrees) /
      fadeStartFieldOfViewDegrees) *
    1.4;
  return Math.max(0, Math.min(0.82, opacity));
};

const limitingMagnitudeForFieldOfView = (fieldOfViewDegrees: number) => {
  if (fieldOfViewDegrees >= 100) return 5.5;
  if (fieldOfViewDegrees >= 50) return 6;
  if (fieldOfViewDegrees >= 20) return 6.5;
  return 7;
};

const starStyle = (star: HorizontalRegisteredStar) => {
  const color =
    star.colorIndexBv !== undefined && star.colorIndexBv < 0.2
      ? '#b9d8ff'
      : star.colorIndexBv !== undefined && star.colorIndexBv > 1
        ? '#ffd0a0'
        : '#f2f5ff';
  const radiusPixels =
    star.magnitude <= 1.5
      ? 2.25
      : star.magnitude <= 3.5
        ? 1.65
        : star.magnitude <= 5
          ? 1.15
          : 0.8;
  return { color, radiusPixels };
};

export const selectRegisteredStarBatches = (
  projectedStars: readonly HorizontalRegisteredStar[],
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): RegisteredStarBatch[] => {
  const limitingMagnitude = limitingMagnitudeForFieldOfView(
    camera.fieldOfViewDegrees,
  );
  const cameraCenter = getPlanetariumCameraCenter(camera);
  const halfMinimumDimensionPixels =
    Math.min(canvas.widthPixels, canvas.heightPixels) / 2;
  const cornerRadiusPixels = Math.hypot(
    canvas.widthPixels / 2,
    canvas.heightPixels / 2,
  );
  const cornerAngularRadiusDegrees =
    (2 *
      Math.atan(
        (cornerRadiusPixels / Math.max(1, halfMinimumDimensionPixels)) *
          Math.tan((camera.fieldOfViewDegrees * Math.PI) / 720),
      ) *
      180) /
    Math.PI;
  const residentRadiusDegrees = Math.min(
    180,
    cornerAngularRadiusDegrees + camera.fieldOfViewDegrees * 0.15,
  );
  const batches = new Map<string, RegisteredStarBatch>();
  for (const star of projectedStars) {
    if (
      star.magnitude > limitingMagnitude ||
      angularSeparationDegrees(cameraCenter, star) > residentRadiusDegrees
    ) {
      continue;
    }
    const style = starStyle(star);
    const key = `${style.color}-${style.radiusPixels}`;
    const batch = batches.get(key) ?? { ...style, directions: [], key };
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
