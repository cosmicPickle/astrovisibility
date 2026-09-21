import { createBlockedBitset, type RasterMask } from './rasterMask';
import {
  createVisibilityMaskEvaluator,
  type VisibilityMask,
} from './visibilityMask';

/** Synthetic fixture preparation only. Legacy polygon scenarios are converted
 * before benchmark timing so full-frame tests exercise the shipped raster
 * representation without including offline fixture generation in runtime cost.
 */
export function rasterizeMaskFixture(
  mask: VisibilityMask,
  size = 2048,
): RasterMask {
  const blockedBitset = createBlockedBitset(size, size, true);
  const evaluate = createVisibilityMaskEvaluator(mask);
  const { hypot, atan2, PI } = Math;
  const half = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radius = hypot(x - half, half - y);
      if (radius > half) continue;
      const direction = {
        altitudeDegrees: 90 - (radius / half) * 90,
        azimuthDegrees: ((atan2(x - half, half - y) * 180) / PI + 360) % 360,
      };
      if (evaluate.classify(direction) === 'visible') {
        const index = y * size + x;
        blockedBitset[index >> 3] =
          blockedBitset[index >> 3]! & ~(1 << (index & 7));
      }
    }
  }
  return {
    widthPixels: size,
    heightPixels: size,
    uri: 'synthetic-mask',
    blockedBitset,
  };
}
