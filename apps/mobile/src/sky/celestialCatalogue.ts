import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import {
  equatorialJ2000ToUnitVector,
  observedHorizontalVectorToJ2000,
  projectJ2000ToObservedHorizontalVector,
  type CelestialTimeTransform,
  type UnitVector3,
} from '../astronomy/celestialTimeTransform';
import {
  buildPlanetariumCatalogueIndex,
  getPlanetariumProminenceTierLimit,
  getResidentAngularRadiusDegrees,
  selectPlanetariumResidentTargets,
  type HorizontalCatalogueTarget,
} from './planetariumCatalogue';
import {
  vectorToHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';
import type { CanvasSizePixels } from './projection';

export interface CelestialCatalogueTarget {
  j2000UnitVector: UnitVector3;
  target: CatalogueTarget;
}

export const createCelestialCatalogue = (
  targets: readonly CatalogueTarget[],
): CelestialCatalogueTarget[] =>
  targets.map((target) => ({
    j2000UnitVector: equatorialJ2000ToUnitVector({
      declinationJ2000Degrees: target.declinationJ2000Degrees,
      rightAscensionJ2000Hours: target.rightAscensionJ2000Hours,
    }),
    target,
  }));

const dotProduct = (left: UnitVector3, right: UnitVector3) =>
  left.x * right.x + left.y * right.y + left.z * right.z;

export const selectCelestialResidentTargets = (input: {
  camera: PlanetariumCamera;
  canvas: CanvasSizePixels;
  catalogue: readonly CelestialCatalogueTarget[];
  densityCandidateCount: number;
  floorTargetIds: ReadonlySet<string>;
  selectedTargetId: string | null;
  timeTransform: CelestialTimeTransform;
  timestampMilliseconds: number;
}): HorizontalCatalogueTarget[] => {
  const timestampMilliseconds = Math.max(
    input.timeTransform.startTimestampMilliseconds,
    Math.min(
      input.timeTransform.endTimestampMilliseconds,
      input.timestampMilliseconds,
    ),
  );
  const cameraCenterJ2000 = observedHorizontalVectorToJ2000(
    input.camera.forward,
    input.timeTransform,
    timestampMilliseconds,
  );
  const residentRadiusDegrees = getResidentAngularRadiusDegrees(
    input.camera,
    input.canvas,
  );
  const minimumResidentDotProduct = Math.cos(
    (residentRadiusDegrees * Math.PI) / 180,
  );
  const prominenceTierLimit = getPlanetariumProminenceTierLimit(
    input.camera.fieldOfViewDegrees,
  );
  const candidates: HorizontalCatalogueTarget[] = [];

  for (const item of input.catalogue) {
    const selected = item.target.id === input.selectedTargetId;
    if (
      !selected &&
      !input.floorTargetIds.has(item.target.id) &&
      item.target.prominenceTier > prominenceTierLimit
    ) {
      continue;
    }
    if (
      residentRadiusDegrees < 180 &&
      dotProduct(item.j2000UnitVector, cameraCenterJ2000) <
        minimumResidentDotProduct
    ) {
      continue;
    }
    const observedVector = projectJ2000ToObservedHorizontalVector(
      item.j2000UnitVector,
      input.timeTransform,
      timestampMilliseconds,
    );
    const direction = vectorToHorizontalDirection(observedVector);
    candidates.push({
      altitudeDegrees: direction.altitudeDegrees,
      azimuthDegrees: direction.azimuthDegrees,
      target: item.target,
    });
  }

  return selectPlanetariumResidentTargets(
    buildPlanetariumCatalogueIndex(candidates),
    input.camera,
    input.canvas,
    {
      densityCandidateCount: input.densityCandidateCount,
      floorTargetIds: input.floorTargetIds,
      selectedTargetId: input.selectedTargetId,
    },
  );
};
