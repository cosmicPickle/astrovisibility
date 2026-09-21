import type { ImagingFrame } from '../astronomy/imagingFrame';
import type { Vector3 } from '../sky/planetariumProjection';
import { blockedBitsetByteLength, type RasterMask } from './rasterMask';

const { sin, cos, hypot, min, max, acos, sqrt, PI } = Math;

// An atlas pixel owns its nearest-neighbour cell, matching classifyRasterMaskDirection.
// Resolve curved cell/footprint intersections to 0.0001 degrees; contact is blocked.
const INTERSECTION_TOLERANCE_RADIANS = (0.0001 * PI) / 180;
const MAXIMUM_QUERY_NODES = 100_000;
const MAXIMUM_RASTER_PIXELS = 2048 * 2048;
type MaskLevel = { width: number; height: number; cells: Uint8Array };
export type FrameMaskEvaluator = {
  isBlocked(frame: ImagingFrame): boolean;
  capIntersects(
    center: Vector3,
    radiusDegrees: number,
    blocked: boolean,
  ): boolean;
};
const evaluators = new WeakMap<RasterMask, FrameMaskEvaluator>();

/** A compact occupancy pyramid: 0 clear, 1 blocked, 2 mixed. At 2048² this
 * uses <5.6 MB plus <4.2 MB for spherical caps at 2048². Clear/blocked
 * regions can be rejected without scanning every pixel.
 */
function createLevels(raster: RasterMask): MaskLevel[] {
  const { widthPixels: width, heightPixels: height, blockedBitset } = raster;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAXIMUM_RASTER_PIXELS ||
    blockedBitset.length !== blockedBitsetByteLength(width, height)
  )
    throw new RangeError('Invalid full-frame mask dimensions or bitset.');
  const cells = new Uint8Array(width * height);
  for (let index = 0; index < cells.length; index += 1)
    cells[index] = (blockedBitset[index >> 3]! >> (index & 7)) & 1;
  const levels: MaskLevel[] = [{ width, height, cells }];
  while (levels.at(-1)!.width > 1 || levels.at(-1)!.height > 1) {
    const previous = levels.at(-1)!;
    const next = {
      width: Math.ceil(previous.width / 2),
      height: Math.ceil(previous.height / 2),
      cells: new Uint8Array(
        Math.ceil(previous.width / 2) * Math.ceil(previous.height / 2),
      ),
    };
    for (let y = 0; y < next.height; y += 1) {
      for (let x = 0; x < next.width; x += 1) {
        let state = -1;
        for (let dy = 0; dy < 2; dy += 1)
          for (let dx = 0; dx < 2; dx += 1) {
            if (x * 2 + dx >= previous.width || y * 2 + dy >= previous.height)
              continue;
            const child =
              previous.cells[(y * 2 + dy) * previous.width + x * 2 + dx]!;
            state = state === -1 ? child : state === child ? state : 2;
          }
        next.cells[y * next.width + x] = state;
      }
    }
    levels.push(next);
  }
  return levels;
}

function prepareMaskIndex(raster: RasterMask) {
  const levels = createLevels(raster);
  const radiansPerPixel = PI / min(raster.widthPixels, raster.heightPixels);
  const preparedCaps = levels.map((level, levelIndex) => {
    if (levelIndex < 3) return null;
    const caps = new Float64Array(level.cells.length * 6);
    const size = 2 ** levelIndex;
    for (let row = 0; row < level.height; row += 1)
      for (let column = 0; column < level.width; column += 1) {
        const left = column * size - 0.5;
        const top = row * size - 0.5;
        const right =
          (column + 1) * size >= raster.widthPixels
            ? raster.widthPixels
            : (column + 1) * size - 0.5;
        const bottom =
          (row + 1) * size >= raster.heightPixels
            ? raster.heightPixels
            : (row + 1) * size - 0.5;
        const east =
          ((left + right) / 2 - raster.widthPixels / 2) * radiansPerPixel;
        const north =
          (raster.heightPixels / 2 - (top + bottom) / 2) * radiansPerPixel;
        const radial = hypot(east, north);
        const scale = radial > 1e-12 ? sin(radial) / radial : 1;
        const radius = min(
          PI,
          (hypot(right - left, bottom - top) / 2) * radiansPerPixel,
        );
        caps.set(
          [
            east * scale,
            cos(radial),
            north * scale,
            radius,
            cos(radius),
            sin(radius),
          ],
          (row * level.width + column) * 6,
        );
      }
    return caps;
  });
  return { levels, radiansPerPixel, preparedCaps };
}

function createIntersectionQuery(raster: RasterMask) {
  const { levels, radiansPerPixel, preparedCaps } = prepareMaskIndex(raster);
  return (
    frame: { planes: readonly (Vector3 & { minimumDot?: number })[] },
    wantedState: number,
  ) => {
    let visited = 0;
    const planes = frame.planes.map((plane) => ({
      ...plane,
      minimumDot: plane.minimumDot ?? 0,
      angularRadius: acos(plane.minimumDot ?? 0),
      sineRadius: sqrt(1 - (plane.minimumDot ?? 0) ** 2),
    }));
    // Inverse azimuthal-equidistant mapping is non-expansive on this
    // hemisphere: a pixel rectangle fits inside this spherical cap. Testing
    // cap/half-space bounds cannot skip an interior branch or blocked island.
    const relation = (
      left: number,
      top: number,
      right: number,
      bottom: number,
      cap?: Float64Array | null,
      capIndex = 0,
    ) => {
      if (++visited > MAXIMUM_QUERY_NODES)
        throw new RangeError('Full-frame mask query exceeded its work limit.');
      let x: number,
        y: number,
        z: number,
        radius: number,
        cosineRadius: number,
        sineRadius: number;
      if (cap) {
        x = cap[capIndex]!;
        y = cap[capIndex + 1]!;
        z = cap[capIndex + 2]!;
        radius = cap[capIndex + 3]!;
        cosineRadius = cap[capIndex + 4]!;
        sineRadius = cap[capIndex + 5]!;
      } else {
        const east =
          ((left + right) / 2 - raster.widthPixels / 2) * radiansPerPixel;
        const north =
          (raster.heightPixels / 2 - (top + bottom) / 2) * radiansPerPixel;
        const radial = hypot(east, north);
        const scale = radial > 1e-12 ? sin(radial) / radial : 1;
        x = east * scale;
        y = cos(radial);
        z = north * scale;
        radius = min(
          PI,
          (hypot(right - left, bottom - top) / 2) * radiansPerPixel,
        );
        cosineRadius = cos(radius);
        sineRadius = sin(radius);
      }
      let centerInside = true;
      for (const plane of planes) {
        const dot = max(-1, min(1, plane.x * x + plane.y * y + plane.z * z));
        const outsideThreshold =
          radius + plane.angularRadius >= PI
            ? -1
            : plane.minimumDot * cosineRadius - plane.sineRadius * sineRadius;
        if (dot < outsideThreshold - 1e-14) return -1;
        if (dot < plane.minimumDot) centerInside = false;
      }
      if (centerInside || radius <= INTERSECTION_TOLERANCE_RADIANS) return 1;
      return 0;
    };
    const intersectsBlockedCell = (
      left: number,
      top: number,
      right: number,
      bottom: number,
    ): boolean => {
      const intersection = relation(left, top, right, bottom);
      if (intersection !== 0) return intersection > 0;
      const middleX = (left + right) / 2;
      const middleY = (top + bottom) / 2;
      return (
        intersectsBlockedCell(left, top, middleX, middleY) ||
        intersectsBlockedCell(middleX, top, right, middleY) ||
        intersectsBlockedCell(left, middleY, middleX, bottom) ||
        intersectsBlockedCell(middleX, middleY, right, bottom)
      );
    };
    const visit = (levelIndex: number, x: number, y: number): boolean => {
      const level = levels[levelIndex]!;
      if (x >= level.width || y >= level.height) return false;
      const state = level.cells[y * level.width + x]!;
      if (state !== 2 && state !== wantedState) return false;
      const size = 2 ** levelIndex;
      const left = x * size - 0.5;
      const top = y * size - 0.5;
      const right =
        (x + 1) * size >= raster.widthPixels
          ? raster.widthPixels
          : (x + 1) * size - 0.5;
      const bottom =
        (y + 1) * size >= raster.heightPixels
          ? raster.heightPixels
          : (y + 1) * size - 0.5;
      const intersection = relation(
        left,
        top,
        right,
        bottom,
        preparedCaps[levelIndex],
        (y * level.width + x) * 6,
      );
      if (intersection < 0) return false;
      if (state === wantedState && intersection > 0) return true;
      if (levelIndex === 0)
        return intersectsBlockedCell(left, top, right, bottom);
      return (
        visit(levelIndex - 1, x * 2, y * 2) ||
        visit(levelIndex - 1, x * 2 + 1, y * 2) ||
        visit(levelIndex - 1, x * 2, y * 2 + 1) ||
        visit(levelIndex - 1, x * 2 + 1, y * 2 + 1)
      );
    };
    return visit(levels.length - 1, 0, 0);
  };
}

export function createFrameMaskEvaluator(
  raster: RasterMask,
): FrameMaskEvaluator {
  const cached = evaluators.get(raster);
  if (cached) return cached;
  const intersects = createIntersectionQuery(raster);
  const evaluator: FrameMaskEvaluator = {
    isBlocked: (frame) =>
      frame.corners.some(({ y }) => y < 0) || intersects(frame, 1),
    capIntersects: (center, radiusDegrees, blocked) =>
      intersects(
        {
          planes: [
            { ...center, minimumDot: cos((radiusDegrees * PI) / 180) },
            { x: 0, y: 1, z: 0 },
          ],
        },
        blocked ? 1 : 0,
      ),
  };
  evaluators.set(raster, evaluator);
  return evaluator;
}
