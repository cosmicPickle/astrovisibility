import { Observer, Refraction, Rotation_HOR_EQJ } from 'astronomy-engine';
import type { ObserverLocation } from '../astronomy/horizontalCoordinates';
import {
  createPlanetariumProjectionContext,
  type PlanetariumCamera,
  type Vector3,
} from './planetariumProjection.ts';
import type { CanvasSizePixels } from './projection';

export const CUBE_FACE_PIXELS = 1024;
export const CUBE_PADDING_PIXELS = 2;
export const REFRACTION_TABLE_WIDTH = 4096;
const COEFFICIENT_RANGE = 0.02;

/** Six faces in +X,-X,+Y,-Y,+Z,-Z order, top-left texture origin. */
export function cubeDirection(face: number, u: number, v: number): Vector3 {
  const horizontal = 2 * u - 1,
    vertical = 2 * v - 1;
  const axes = [
    { x: 1, y: -vertical, z: -horizontal },
    { x: -1, y: -vertical, z: horizontal },
    { x: horizontal, y: 1, z: vertical },
    { x: horizontal, y: -1, z: -vertical },
    { x: horizontal, y: -vertical, z: 1 },
    { x: -horizontal, y: -vertical, z: -1 },
  ];
  const direction = axes[face];
  if (!direction) throw new RangeError('Cube face must be 0..5.');
  const length = Math.hypot(direction.x, direction.y, direction.z);
  return {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };
}

export function cubeUv(direction: Vector3) {
  const { x, y, z } = direction;
  const ax = Math.abs(x),
    ay = Math.abs(y),
    az = Math.abs(z);
  let face: number, horizontal: number, vertical: number, major: number;
  if (ax >= ay && ax >= az) {
    face = x >= 0 ? 0 : 1;
    major = ax;
    horizontal = x >= 0 ? -z : z;
    vertical = -y;
  } else if (ay >= az) {
    face = y >= 0 ? 2 : 3;
    major = ay;
    horizontal = x;
    vertical = y >= 0 ? z : -z;
  } else {
    face = z >= 0 ? 4 : 5;
    major = az;
    horizontal = z >= 0 ? x : -x;
    vertical = -y;
  }
  return {
    face,
    u: (horizontal / major + 1) / 2,
    v: (vertical / major + 1) / 2,
  };
}

/** Algebraic inverse stereographic projection; no per-pixel angular functions. */
export function screenDirection(
  point: { xPixels: number; yPixels: number },
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
): Vector3 {
  const scale = createPlanetariumProjectionContext(
    camera,
    canvas,
  ).projectionScalePixels;
  const x = (point.xPixels - canvas.widthPixels / 2) / scale;
  const y = (canvas.heightPixels / 2 - point.yPixels) / scale;
  const radiusSquared = x * x + y * y,
    inverse = 1 / (1 + radiusSquared);
  const right = 2 * x * inverse,
    up = 2 * y * inverse,
    forward = (1 - radiusSquared) * inverse;
  return {
    x: camera.right.x * right + camera.up.x * up + camera.forward.x * forward,
    y: camera.right.y * right + camera.up.y * up + camera.forward.y * forward,
    z: camera.right.z * right + camera.up.z * up + camera.forward.z * forward,
  };
}

export interface CelestialCubeOrientation {
  eastJ2000: number[];
  upJ2000: number[];
  northJ2000: number[];
}

export function createCelestialCubeOrientation(input: {
  observer: ObserverLocation;
  timestampUtc: string;
}): CelestialCubeOrientation {
  const { observer } = input;
  const rotation = Rotation_HOR_EQJ(
    new Date(input.timestampUtc),
    new Observer(
      observer.latitudeDegreesNorth,
      observer.longitudeDegreesEast,
      observer.elevationMetersAboveMeanSeaLevel,
    ),
  ).rot;
  // Astronomy Engine's HOR axes are north, west, up; ours are east, up, north.
  return {
    eastJ2000: rotation[1]!.map((value) => -value),
    upJ2000: [...rotation[2]!],
    northJ2000: [...rotation[0]!],
  };
}

function inverseRefractionCoefficients(observedY: number): [number, number] {
  if (Math.abs(observedY) >= 1) return [0, 0];
  const observedAltitude = (Math.asin(observedY) * 180) / Math.PI;
  let lower = Math.max(-90, observedAltitude - 2),
    upper = observedAltitude;
  // The library inverse uses an unbounded loop at sub-ULP tolerance. Bisection
  // over the monotone normal-refraction mapping has bounded work and precision.
  for (let iteration = 0; iteration < 40; iteration++) {
    const middle = (lower + upper) / 2;
    if (middle + Refraction('normal', middle) < observedAltitude)
      lower = middle;
    else upper = middle;
  }
  const geometricRadians = (((lower + upper) / 2) * Math.PI) / 180;
  return [
    Math.cos(geometricRadians) / Math.sqrt(1 - observedY * observedY) - 1,
    Math.sin(geometricRadians) - observedY,
  ];
}

/** Two opaque RG16 rows: horizontal scale delta, then vertical delta.
 * Linear texture interpolation also linearly interpolates the decoded values.
 * No private location/time is encoded; this is the universal normal model. */
export function createInverseRefractionTable(): Uint8Array {
  const bytes = new Uint8Array(REFRACTION_TABLE_WIDTH * 2 * 4);
  for (let column = 0; column < REFRACTION_TABLE_WIDTH; column++) {
    const coefficients = inverseRefractionCoefficients(
      (column / (REFRACTION_TABLE_WIDTH - 1)) * 2 - 1,
    );
    for (let row = 0; row < 2; row++) {
      const coefficient = coefficients[row]!;
      if (Math.abs(coefficient) > COEFFICIENT_RANGE)
        throw new RangeError('Refraction coefficient exceeds table range.');
      const value = Math.round(
        (coefficient / COEFFICIENT_RANGE + 1) * 0.5 * 65535,
      );
      const offset = (row * REFRACTION_TABLE_WIDTH + column) * 4;
      bytes[offset] = value >> 8;
      bytes[offset + 1] = value & 255;
      bytes[offset + 3] = 255;
    }
  }
  return bytes;
}

export function sampleInverseRefraction(
  table: Uint8Array,
  observedY: number,
): [number, number] {
  const position =
    Math.max(0, Math.min(1, (observedY + 1) / 2)) *
    (REFRACTION_TABLE_WIDTH - 1);
  const left = Math.floor(position),
    right = Math.min(left + 1, REFRACTION_TABLE_WIDTH - 1),
    fraction = position - left;
  const sample = (row: number, column: number) => {
    const offset = (row * REFRACTION_TABLE_WIDTH + column) * 4;
    return (
      (((table[offset]! * 256 + table[offset + 1]!) / 65535) * 2 - 1) *
      COEFFICIENT_RANGE
    );
  };
  return [0, 1].map(
    (row) => sample(row, left) * (1 - fraction) + sample(row, right) * fraction,
  ) as [number, number];
}

export function observedToJ2000(
  direction: Vector3,
  orientation: CelestialCubeOrientation,
  coefficients: [number, number],
): Vector3 {
  const { eastJ2000, upJ2000, northJ2000 } = orientation;
  const east = direction.x * (1 + coefficients[0]),
    up = direction.y + coefficients[1],
    north = direction.z * (1 + coefficients[0]);
  const output = [0, 1, 2].map(
    (index) =>
      eastJ2000[index]! * east +
      upJ2000[index]! * up +
      northJ2000[index]! * north,
  );
  const length = Math.hypot(...output);
  return {
    x: output[0]! / length,
    y: output[1]! / length,
    z: output[2]! / length,
  };
}
