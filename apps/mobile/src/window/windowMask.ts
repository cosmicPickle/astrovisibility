import { blockedBitsetByteLength, type RasterMask } from '../mask/rasterMask';
import { atlasPixelToDirection } from '../panorama/directionalAtlas';
import { horizontalDirectionToVector } from '../sky/planetariumProjection';
import {
  createWindowGeometry,
  windowContainsRay,
  type WindowDefinition,
  type WindowGeometry,
} from './windowGeometry';

export interface WindowCorrection {
  geometry: WindowGeometry;
  backgroundRaster: RasterMask;
}

/** Preserve the source mask. The separately defined rectangle owns the nearby
 * border; interior mask obstacles remain distant angular obstructions. Hidden
 * background is assumed clear only within photographed coverage. Bounded chunks
 * keep this preparation out of the per-target loop and yield during loading. */
export async function prepareWindowCorrection(
  raster: RasterMask,
  coverage: Uint8Array,
  definition: WindowDefinition,
  yieldToEventLoop: () => Promise<void> = () =>
    new Promise((resolve) => setTimeout(resolve, 0)),
): Promise<WindowCorrection> {
  const count = raster.widthPixels * raster.heightPixels;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 2048 * 2048 ||
    coverage.length !==
      blockedBitsetByteLength(raster.widthPixels, raster.heightPixels) ||
    raster.blockedBitset.length !== coverage.length
  )
    throw new Error('Invalid window mask coverage.');
  const geometry = createWindowGeometry(definition);
  const blockedBitset = new Uint8Array(coverage.length);
  for (let index = 0; index < count; index += 1) {
    const bit = 1 << (index & 7);
    let blocked = (coverage[index >> 3]! & bit) === 0;
    if (!blocked && (raster.blockedBitset[index >> 3]! & bit) !== 0) {
      const direction = atlasPixelToDirection(
        {
          xPixels: index % raster.widthPixels,
          yPixels: Math.floor(index / raster.widthPixels),
        },
        raster,
      );
      blocked =
        direction === null ||
        windowContainsRay(geometry, horizontalDirectionToVector(direction));
    }
    if (blocked) blockedBitset[index >> 3] = blockedBitset[index >> 3]! | bit;
    if (index % 16384 === 16383) await yieldToEventLoop();
  }
  return { geometry, backgroundRaster: { ...raster, blockedBitset } };
}
