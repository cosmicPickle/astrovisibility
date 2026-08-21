import { directionToAtlasPixel } from '../panorama/directionalAtlas';
import {
  unwrapAzimuthDegreesNear,
  type HorizontalDirectionDegrees,
} from '../sky/projection';
import type { VisibilityMaskOperation } from './visibilityMask';

export const blockedBitsetByteLength = (
  widthPixels: number,
  heightPixels: number,
) => Math.ceil((widthPixels * heightPixels) / 8);

export function createBlockedBitset(
  widthPixels: number,
  heightPixels: number,
  blocked: boolean,
): Uint8Array {
  const bitset = new Uint8Array(
    blockedBitsetByteLength(widthPixels, heightPixels),
  );
  if (blocked) bitset.fill(0xff);
  return bitset;
}

const pixelIndex = (
  widthPixels: number,
  heightPixels: number,
  xPixels: number,
  yPixels: number,
) => {
  if (
    !Number.isInteger(xPixels) ||
    !Number.isInteger(yPixels) ||
    xPixels < 0 ||
    xPixels >= widthPixels ||
    yPixels < 0 ||
    yPixels >= heightPixels
  ) {
    throw new RangeError('Mask pixel is outside the raster.');
  }
  return yPixels * widthPixels + xPixels;
};

export function readBlockedPixel(
  bitset: Uint8Array,
  widthPixels: number,
  heightPixels: number,
  xPixels: number,
  yPixels: number,
): boolean {
  if (bitset.length !== blockedBitsetByteLength(widthPixels, heightPixels)) {
    throw new RangeError('Mask bitset length does not match its dimensions.');
  }
  const index = pixelIndex(widthPixels, heightPixels, xPixels, yPixels);
  return (bitset[index >> 3]! & (1 << (index & 7))) !== 0;
}

export function writeBlockedPixel(
  bitset: Uint8Array,
  widthPixels: number,
  heightPixels: number,
  xPixels: number,
  yPixels: number,
  blocked: boolean,
): void {
  if (bitset.length !== blockedBitsetByteLength(widthPixels, heightPixels)) {
    throw new RangeError('Mask bitset length does not match its dimensions.');
  }
  const index = pixelIndex(widthPixels, heightPixels, xPixels, yPixels);
  const mask = 1 << (index & 7);
  if (blocked) bitset[index >> 3] = bitset[index >> 3]! | mask;
  else bitset[index >> 3] = bitset[index >> 3]! & ~mask;
}

export function createCoverageBitsetFromRgba(
  rgbaPixels: Uint8Array,
  widthPixels: number,
  heightPixels: number,
): Uint8Array {
  if (rgbaPixels.length !== widthPixels * heightPixels * 4) {
    throw new RangeError('RGBA pixel length does not match its dimensions.');
  }
  const coverage = createBlockedBitset(widthPixels, heightPixels, false);
  for (let index = 0; index < widthPixels * heightPixels; index += 1) {
    if (rgbaPixels[index * 4 + 3]! > 0) {
      coverage[index >> 3] = coverage[index >> 3]! | (1 << (index & 7));
    }
  }
  return coverage;
}

export function createBlockedBitsetFromCoverage(
  coverageBitset: Uint8Array,
  widthPixels: number,
  heightPixels: number,
): Uint8Array {
  if (
    coverageBitset.length !== blockedBitsetByteLength(widthPixels, heightPixels)
  ) {
    throw new RangeError(
      'Coverage bitset length does not match its dimensions.',
    );
  }
  const blocked = new Uint8Array(coverageBitset.length);
  for (let index = 0; index < coverageBitset.length; index += 1) {
    blocked[index] = ~coverageBitset[index]! & 0xff;
  }
  return blocked;
}

export function createMaskRgba(
  blockedBitset: Uint8Array,
  widthPixels: number,
  heightPixels: number,
): Uint8Array {
  if (
    blockedBitset.length !== blockedBitsetByteLength(widthPixels, heightPixels)
  ) {
    throw new RangeError('Mask bitset length does not match its dimensions.');
  }
  const rgba = new Uint8Array(widthPixels * heightPixels * 4);
  for (
    let pixelIndex = 0;
    pixelIndex < widthPixels * heightPixels;
    pixelIndex += 1
  ) {
    if ((blockedBitset[pixelIndex >> 3]! & (1 << (pixelIndex & 7))) === 0) {
      continue;
    }
    const rgbaIndex = pixelIndex * 4;
    rgba[rgbaIndex] = 196;
    rgba[rgbaIndex + 1] = 202;
    rgba[rgbaIndex + 2] = 214;
    rgba[rgbaIndex + 3] = 255;
  }
  return rgba;
}

export type RasterMask = Readonly<{
  blockedBitset: Uint8Array;
  heightPixels: number;
  uri: string;
  widthPixels: number;
}>;

export function classifyRasterMaskDirection(
  raster: RasterMask,
  direction: HorizontalDirectionDegrees,
): 'blocked' | 'visible' {
  if (direction.altitudeDegrees < 0 || direction.altitudeDegrees > 90)
    return 'blocked';
  const point = directionToAtlasPixel(direction, raster);
  const xPixels = Math.max(
    0,
    Math.min(raster.widthPixels - 1, Math.round(point.xPixels)),
  );
  const yPixels = Math.max(
    0,
    Math.min(raster.heightPixels - 1, Math.round(point.yPixels)),
  );
  return readBlockedPixel(
    raster.blockedBitset,
    raster.widthPixels,
    raster.heightPixels,
    xPixels,
    yPixels,
  )
    ? 'blocked'
    : 'visible';
}

export function rasterMaskSegmentMayCrossBoundary(
  raster: RasterMask,
  left: HorizontalDirectionDegrees,
  right: HorizontalDirectionDegrees,
): boolean {
  const rightAzimuthDegrees = unwrapAzimuthDegreesNear(
    right.azimuthDegrees,
    left.azimuthDegrees,
  );
  const angularPixelDegrees =
    180 / Math.min(raster.widthPixels, raster.heightPixels);
  const approximateLengthDegrees = Math.hypot(
    right.altitudeDegrees - left.altitudeDegrees,
    (rightAzimuthDegrees - left.azimuthDegrees) *
      Math.cos(
        ((left.altitudeDegrees + right.altitudeDegrees) / 2) * (Math.PI / 180),
      ),
  );
  const sampleCount = Math.max(
    1,
    Math.min(4096, Math.ceil(approximateLengthDegrees / angularPixelDegrees)),
  );
  let previous = classifyRasterMaskDirection(raster, left);
  for (let index = 1; index <= sampleCount; index += 1) {
    const ratio = index / sampleCount;
    const classification = classifyRasterMaskDirection(raster, {
      altitudeDegrees:
        left.altitudeDegrees +
        (right.altitudeDegrees - left.altitudeDegrees) * ratio,
      azimuthDegrees:
        left.azimuthDegrees +
        (rightAzimuthDegrees - left.azimuthDegrees) * ratio,
    });
    if (classification !== previous) return true;
    previous = classification;
  }
  return false;
}

export function applyRasterMaskOperations(
  initialBlockedBitset: Uint8Array,
  coverageBitset: Uint8Array,
  widthPixels: number,
  heightPixels: number,
  operations: readonly VisibilityMaskOperation[],
): Uint8Array {
  const expectedLength = blockedBitsetByteLength(widthPixels, heightPixels);
  if (
    initialBlockedBitset.length !== expectedLength ||
    coverageBitset.length !== expectedLength
  ) {
    throw new RangeError(
      'Mask and coverage bitsets must match the atlas dimensions.',
    );
  }
  const blocked = initialBlockedBitset.slice();
  const readRaw = (bitset: Uint8Array, index: number) =>
    (bitset[index >> 3]! & (1 << (index & 7))) !== 0;
  const writeRaw = (index: number, value: boolean) => {
    const mask = 1 << (index & 7);
    if (value) blocked[index >> 3] = blocked[index >> 3]! | mask;
    else blocked[index >> 3] = blocked[index >> 3]! & ~mask;
  };
  const stamp = (
    centerX: number,
    centerY: number,
    radiusPixels: number,
    value: boolean,
  ) => {
    const minimumX = Math.max(0, Math.floor(centerX - radiusPixels));
    const maximumX = Math.min(
      widthPixels - 1,
      Math.ceil(centerX + radiusPixels),
    );
    const minimumY = Math.max(0, Math.floor(centerY - radiusPixels));
    const maximumY = Math.min(
      heightPixels - 1,
      Math.ceil(centerY + radiusPixels),
    );
    const squaredRadius = radiusPixels * radiusPixels;
    for (let yPixels = minimumY; yPixels <= maximumY; yPixels += 1) {
      for (let xPixels = minimumX; xPixels <= maximumX; xPixels += 1) {
        if (
          (xPixels - centerX) ** 2 + (yPixels - centerY) ** 2 >
          squaredRadius
        ) {
          continue;
        }
        const index = yPixels * widthPixels + xPixels;
        if (!value && !readRaw(coverageBitset, index)) continue;
        writeRaw(index, value);
      }
    }
  };
  for (const operation of operations) {
    if (operation.kind === 'visiblePolygon') continue;
    const points = operation.points.map((point) =>
      directionToAtlasPixel(point, { heightPixels, widthPixels }),
    );
    const radiusPixels = Math.max(
      0.5,
      (operation.angularRadiusDegrees / 90) *
        (Math.min(widthPixels, heightPixels) / 2),
    );
    const blockedValue = operation.kind === 'blockedStroke';
    if (points.length === 1) {
      stamp(points[0]!.xPixels, points[0]!.yPixels, radiusPixels, blockedValue);
      continue;
    }
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      const start = points[pointIndex - 1]!;
      const end = points[pointIndex]!;
      const distancePixels = Math.hypot(
        end.xPixels - start.xPixels,
        end.yPixels - start.yPixels,
      );
      const steps = Math.max(
        1,
        Math.ceil(distancePixels / Math.max(1, radiusPixels / 2)),
      );
      for (let step = 0; step <= steps; step += 1) {
        const ratio = step / steps;
        stamp(
          start.xPixels + (end.xPixels - start.xPixels) * ratio,
          start.yPixels + (end.yPixels - start.yPixels) * ratio,
          radiusPixels,
          blockedValue,
        );
      }
    }
  }
  return blocked;
}
