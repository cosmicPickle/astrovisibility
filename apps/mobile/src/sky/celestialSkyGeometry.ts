import constellationsJson from './generated/constellations.json';
import starsJson from './generated/stars.json';

import {
  equatorialJ2000ToUnitVector,
  type UnitVector3,
} from '../astronomy/celestialTimeTransform';
import {
  createEquatorialAtlasTiles,
  createEquatorialCutoutMesh,
  createGridIndices,
  type EquatorialDirection,
  type EquatorialImageMesh,
} from './registeredSkyGeometry';
import type {
  RegisteredDsoImageDefinition,
  RegisteredStarBatch,
} from './registeredSkyProjection';

type RegisteredStarRow = readonly [
  id: string,
  rightAscensionJ2000Hours: number,
  declinationJ2000Degrees: number,
  magnitude: number,
  colorIndexBv: number | null,
  properName: string | null,
];

type RegisteredConstellationSource = {
  id: string;
  label: EquatorialDirection;
  lines: EquatorialDirection[][];
  name: string;
  rank: number;
};

export interface CelestialImageMesh {
  angularRadiusDegrees: number;
  centerJ2000UnitVector: UnitVector3;
  columnCount: number;
  directionVectors: UnitVector3[];
  indices: number[];
  rowCount: number;
  texturePointsPixels: { x: number; y: number }[];
}

export interface RegisteredCelestialStar {
  colorIndexBv?: number;
  id: string;
  j2000UnitVector: UnitVector3;
  magnitude: number;
}

export interface RegisteredCelestialStarBatch extends Omit<
  RegisteredStarBatch,
  'directions'
> {
  directions: RegisteredCelestialStar[];
}

export interface RegisteredCelestialConstellation {
  id: string;
  labelJ2000UnitVector: UnitVector3;
  lineJ2000UnitVectors: UnitVector3[][];
  name: string;
  rank: number;
}

export interface RegisteredCelestialDsoImage {
  mesh: CelestialImageMesh;
  source: number;
  targetId: string;
}

export interface RegisteredCelestialSky {
  atlasMeshes: CelestialImageMesh[];
  constellations: RegisteredCelestialConstellation[];
  stars: RegisteredCelestialStar[];
  wideAtlasMeshes: CelestialImageMesh[];
}

const WIDE_ATLAS_FIELD_OF_VIEW_THRESHOLD_DEGREES = 75;

export const selectCelestialAtlasMeshesForFieldOfView = (
  sky: RegisteredCelestialSky,
  fieldOfViewDegrees: number,
) =>
  fieldOfViewDegrees >= WIDE_ATLAS_FIELD_OF_VIEW_THRESHOLD_DEGREES
    ? sky.wideAtlasMeshes
    : sky.atlasMeshes;

const angularSeparationDegrees = (left: UnitVector3, right: UnitVector3) => {
  const dot = Math.max(
    -1,
    Math.min(1, left.x * right.x + left.y * right.y + left.z * right.z),
  );
  return Math.acos(dot) * (180 / Math.PI);
};

const prepareCelestialMesh = (
  mesh: EquatorialImageMesh,
): CelestialImageMesh => {
  const directionVectors = mesh.directions.map(equatorialJ2000ToUnitVector);
  const centerJ2000UnitVector =
    directionVectors[Math.floor(directionVectors.length / 2)]!;
  return {
    angularRadiusDegrees: Math.max(
      ...directionVectors.map((direction) =>
        angularSeparationDegrees(centerJ2000UnitVector, direction),
      ),
    ),
    centerJ2000UnitVector,
    columnCount: mesh.columnCount,
    directionVectors,
    indices: mesh.indices,
    rowCount: mesh.rowCount,
    texturePointsPixels: mesh.texturePointsPixels,
  };
};

const stars = starsJson as unknown as RegisteredStarRow[];
const constellations = constellationsJson as RegisteredConstellationSource[];

const atlasMeshes = createEquatorialAtlasTiles({
  heightPixels: 1024,
  rightAscensionAtLeftEdgeHours: 6,
  rightAscensionIncreasesToRight: false,
  widthPixels: 2048,
}).map(prepareCelestialMesh);

const WIDE_ATLAS_SAMPLE_INDICES = [0, 3, 6] as const;
const wideAtlasMeshes = atlasMeshes.map((mesh): CelestialImageMesh => {
  const sourceColumnCount = mesh.columnCount;
  const sampledIndices = WIDE_ATLAS_SAMPLE_INDICES.flatMap((row) =>
    WIDE_ATLAS_SAMPLE_INDICES.map((column) => row * sourceColumnCount + column),
  );
  return {
    ...mesh,
    columnCount: WIDE_ATLAS_SAMPLE_INDICES.length,
    directionVectors: sampledIndices.map(
      (index) => mesh.directionVectors[index]!,
    ),
    indices: createGridIndices(
      WIDE_ATLAS_SAMPLE_INDICES.length,
      WIDE_ATLAS_SAMPLE_INDICES.length,
    ),
    rowCount: WIDE_ATLAS_SAMPLE_INDICES.length,
    texturePointsPixels: sampledIndices.map(
      (index) => mesh.texturePointsPixels[index]!,
    ),
  };
});

export const registeredCelestialSky: RegisteredCelestialSky = {
  atlasMeshes,
  constellations: constellations.map((constellation) => ({
    id: constellation.id,
    labelJ2000UnitVector: equatorialJ2000ToUnitVector(constellation.label),
    lineJ2000UnitVectors: constellation.lines.map((line) =>
      line.map(equatorialJ2000ToUnitVector),
    ),
    name: constellation.name,
    rank: constellation.rank,
  })),
  stars: stars.map(
    ([
      id,
      rightAscensionJ2000Hours,
      declinationJ2000Degrees,
      magnitude,
      colorIndexBv,
    ]) => ({
      ...(colorIndexBv === null ? {} : { colorIndexBv }),
      id,
      j2000UnitVector: equatorialJ2000ToUnitVector({
        declinationJ2000Degrees,
        rightAscensionJ2000Hours,
      }),
      magnitude,
    }),
  ),
  wideAtlasMeshes,
};

export const createRegisteredCelestialDsoImages = (
  definitions: readonly RegisteredDsoImageDefinition[],
): RegisteredCelestialDsoImage[] =>
  definitions.map((definition) => ({
    mesh: prepareCelestialMesh(
      createEquatorialCutoutMesh({
        centerDeclinationJ2000Degrees: definition.declinationJ2000Degrees,
        centerRightAscensionJ2000Hours: definition.rightAscensionJ2000Hours,
        fieldOfViewDegrees: definition.fieldOfViewDegrees,
        heightPixels: 256,
        widthPixels: 256,
      }),
    ),
    source: definition.source,
    targetId: definition.targetId,
  }));
