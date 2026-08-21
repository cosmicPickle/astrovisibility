import type { AngularPointDegrees } from '../mask/visibilityMask';
import {
  createPlanetariumCamera,
  vectorToHorizontalDirection,
  type Vector3,
} from '../sky/planetariumProjection';
import {
  normalizeAzimuthDegrees,
  unwrapAzimuthDegreesNear,
  type HorizontalDirectionDegrees,
} from '../sky/projection';

export type PanoramaTilePlacement = {
  centerAzimuthDegrees: number;
  centerAltitudeDegrees: number;
  horizontalFieldOfViewDegrees: number;
  verticalFieldOfViewDegrees: number;
  rollDegrees: number;
};

type CameraBoundarySample = {
  horizontalRatio: number;
  verticalRatio: number;
  direction: HorizontalDirectionDegrees;
};

const DEGREES_TO_RADIANS = Math.PI / 180;
const MAXIMUM_BOUNDARY_STEP_DEGREES = 1;
const HORIZON_INTERSECTION_ITERATIONS = 40;

const normalizeVector = (vector: Vector3): Vector3 => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length === 0) throw new RangeError('Direction is degenerate');
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};

const validatePlacement = (placement: PanoramaTilePlacement) => {
  if (
    ![
      placement.centerAzimuthDegrees,
      placement.centerAltitudeDegrees,
      placement.horizontalFieldOfViewDegrees,
      placement.verticalFieldOfViewDegrees,
      placement.rollDegrees,
    ].every(Number.isFinite)
  ) {
    throw new RangeError('Tile placement values must be finite');
  }
  if (
    placement.horizontalFieldOfViewDegrees <= 0 ||
    placement.horizontalFieldOfViewDegrees >= 180 ||
    placement.verticalFieldOfViewDegrees <= 0 ||
    placement.verticalFieldOfViewDegrees >= 180
  ) {
    throw new RangeError('Tile fields of view must be within 0..180 degrees');
  }
  if (
    placement.centerAltitudeDegrees < 0 ||
    placement.centerAltitudeDegrees > 90
  ) {
    throw new RangeError('centerAltitudeDegrees must be 0..90');
  }
};

/** Creates the same rolled rectilinear projection used to draw a panorama tile. */
export const createTileDirectionProjector = (
  placement: PanoramaTilePlacement,
) => {
  validatePlacement(placement);
  const camera = createPlanetariumCamera({
    centerAltitudeDegrees: placement.centerAltitudeDegrees,
    centerAzimuthDegrees: placement.centerAzimuthDegrees,
    fieldOfViewDegrees: 60,
  });
  const horizontalTangent = Math.tan(
    (placement.horizontalFieldOfViewDegrees * DEGREES_TO_RADIANS) / 2,
  );
  const verticalTangent = Math.tan(
    (placement.verticalFieldOfViewDegrees * DEGREES_TO_RADIANS) / 2,
  );
  const rollRadians = placement.rollDegrees * DEGREES_TO_RADIANS;
  const cosineRoll = Math.cos(rollRadians);
  const sineRoll = Math.sin(rollRadians);

  return (horizontalRatio: number, verticalRatio: number) => {
    const tangentX = horizontalRatio * horizontalTangent;
    const tangentY = verticalRatio * verticalTangent;
    const rolledX = tangentX * cosineRoll - tangentY * sineRoll;
    const rolledY = tangentX * sineRoll + tangentY * cosineRoll;
    return vectorToHorizontalDirection(
      normalizeVector({
        x: camera.forward.x + camera.right.x * rolledX + camera.up.x * rolledY,
        y: camera.forward.y + camera.right.y * rolledX + camera.up.y * rolledY,
        z: camera.forward.z + camera.right.z * rolledX + camera.up.z * rolledY,
      }),
    );
  };
};

const createBoundarySamples = (placement: PanoramaTilePlacement) => {
  const projectDirection = createTileDirectionProjector(placement);
  const horizontalSegments = Math.ceil(
    placement.horizontalFieldOfViewDegrees / MAXIMUM_BOUNDARY_STEP_DEGREES,
  );
  const verticalSegments = Math.ceil(
    placement.verticalFieldOfViewDegrees / MAXIMUM_BOUNDARY_STEP_DEGREES,
  );
  const samples: CameraBoundarySample[] = [];
  const addSample = (horizontalRatio: number, verticalRatio: number) => {
    samples.push({
      horizontalRatio,
      verticalRatio,
      direction: projectDirection(horizontalRatio, verticalRatio),
    });
  };

  for (let index = 0; index <= horizontalSegments; index += 1) {
    addSample((index / horizontalSegments) * 2 - 1, 1);
  }
  for (let index = 1; index <= verticalSegments; index += 1) {
    addSample(1, 1 - (index / verticalSegments) * 2);
  }
  for (let index = 1; index <= horizontalSegments; index += 1) {
    addSample(1 - (index / horizontalSegments) * 2, -1);
  }
  for (let index = 1; index < verticalSegments; index += 1) {
    addSample(-1, (index / verticalSegments) * 2 - 1);
  }
  return { projectDirection, samples };
};

const findHorizonIntersection = (
  start: CameraBoundarySample,
  end: CameraBoundarySample,
  projectDirection: ReturnType<typeof createTileDirectionProjector>,
): HorizontalDirectionDegrees => {
  let insideRatio = start.direction.altitudeDegrees >= 0 ? 0 : 1;
  let outsideRatio = insideRatio === 0 ? 1 : 0;
  for (
    let iteration = 0;
    iteration < HORIZON_INTERSECTION_ITERATIONS;
    iteration += 1
  ) {
    const ratio = (insideRatio + outsideRatio) / 2;
    const direction = projectDirection(
      start.horizontalRatio +
        (end.horizontalRatio - start.horizontalRatio) * ratio,
      start.verticalRatio + (end.verticalRatio - start.verticalRatio) * ratio,
    );
    if (direction.altitudeDegrees >= 0) insideRatio = ratio;
    else outsideRatio = ratio;
  }
  const direction = projectDirection(
    start.horizontalRatio +
      (end.horizontalRatio - start.horizontalRatio) * insideRatio,
    start.verticalRatio +
      (end.verticalRatio - start.verticalRatio) * insideRatio,
  );
  return { ...direction, altitudeDegrees: 0 };
};

const clipBoundaryToSky = (
  boundary: CameraBoundarySample[],
  projectDirection: ReturnType<typeof createTileDirectionProjector>,
) => {
  const clipped: HorizontalDirectionDegrees[] = [];
  let previous = boundary.at(-1)!;
  for (const current of boundary) {
    const previousInside = previous.direction.altitudeDegrees >= 0;
    const currentInside = current.direction.altitudeDegrees >= 0;
    if (previousInside !== currentInside) {
      clipped.push(
        findHorizonIntersection(previous, current, projectDirection),
      );
    }
    if (currentInside) clipped.push(current.direction);
    previous = current;
  }
  return clipped;
};

export const createTileCoveragePolygon = (
  placement: PanoramaTilePlacement,
): AngularPointDegrees[] => {
  const { projectDirection, samples } = createBoundarySamples(placement);
  const clipped = clipBoundaryToSky(samples, projectDirection);
  const unwrapped: AngularPointDegrees[] = [];
  for (const direction of clipped) {
    const previousAzimuth = unwrapped.at(-1)?.azimuthDegrees;
    unwrapped.push({
      altitudeDegrees: Math.min(90, Math.max(0, direction.altitudeDegrees)),
      azimuthDegrees:
        previousAzimuth === undefined
          ? normalizeAzimuthDegrees(direction.azimuthDegrees)
          : unwrapAzimuthDegreesNear(direction.azimuthDegrees, previousAzimuth),
    });
  }
  const firstAzimuth = unwrapped[0]?.azimuthDegrees;
  const lastAzimuth = unwrapped.at(-1)?.azimuthDegrees;
  if (
    firstAzimuth !== undefined &&
    lastAzimuth !== undefined &&
    Math.abs(lastAzimuth - firstAzimuth) > 180
  ) {
    // A closed spherical boundary winding around zenith needs an explicit top
    // edge when represented in the mask's unwrapped azimuth/altitude plane.
    const topEdgeSegments = Math.ceil(
      Math.abs(lastAzimuth - firstAzimuth) / 10,
    );
    unwrapped.push({ azimuthDegrees: lastAzimuth, altitudeDegrees: 90 });
    for (let index = 1; index <= topEdgeSegments; index += 1) {
      unwrapped.push({
        azimuthDegrees:
          lastAzimuth +
          ((firstAzimuth - lastAzimuth) * index) / topEdgeSegments,
        altitudeDegrees: 90,
      });
    }
  }
  return unwrapped;
};
