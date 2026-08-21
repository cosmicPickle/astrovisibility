import {
  applyRasterMaskOperations,
  classifyRasterMaskDirection,
  createBlockedBitset,
  createBlockedBitsetFromCoverage,
  readBlockedPixel,
  writeBlockedPixel,
} from './rasterMask';

describe('binary raster obstruction mask', () => {
  it('packs and reads one blocked bit per atlas pixel', () => {
    const bitset = createBlockedBitset(5, 3, false);

    writeBlockedPixel(bitset, 5, 3, 4, 2, true);

    expect(readBlockedPixel(bitset, 5, 3, 4, 2)).toBe(true);
    expect(readBlockedPixel(bitset, 5, 3, 3, 2)).toBe(false);
  });

  it('can initialize every direction as blocked', () => {
    const bitset = createBlockedBitset(3, 2, true);

    expect(readBlockedPixel(bitset, 3, 2, 0, 0)).toBe(true);
    expect(readBlockedPixel(bitset, 3, 2, 2, 1)).toBe(true);
  });

  it('turns hard-edged draw and erase strokes into authoritative raster pixels', () => {
    const coverage = createBlockedBitset(100, 100, true);
    const initial = createBlockedBitsetFromCoverage(coverage, 100, 100);
    const drawn = applyRasterMaskOperations(initial, coverage, 100, 100, [
      {
        angularRadiusDegrees: 5,
        id: 'draw-1',
        kind: 'blockedStroke',
        points: [{ altitudeDegrees: 90, azimuthDegrees: 0 }],
      },
    ]);
    const raster = {
      blockedBitset: drawn,
      heightPixels: 100,
      uri: 'file:///mask.png',
      widthPixels: 100,
    };

    expect(
      classifyRasterMaskDirection(raster, {
        altitudeDegrees: 90,
        azimuthDegrees: 0,
      }),
    ).toBe('blocked');

    const erased = applyRasterMaskOperations(drawn, coverage, 100, 100, [
      {
        angularRadiusDegrees: 5,
        id: 'erase-1',
        kind: 'visibleStroke',
        points: [{ altitudeDegrees: 90, azimuthDegrees: 0 }],
      },
    ]);
    expect(
      classifyRasterMaskDirection(
        { ...raster, blockedBitset: erased },
        { altitudeDegrees: 90, azimuthDegrees: 0 },
      ),
    ).toBe('visible');
  });

  it('does not allow erasing directions outside captured coverage', () => {
    const coverage = createBlockedBitset(20, 20, false);
    const initial = createBlockedBitsetFromCoverage(coverage, 20, 20);
    const erased = applyRasterMaskOperations(initial, coverage, 20, 20, [
      {
        angularRadiusDegrees: 20,
        id: 'erase-1',
        kind: 'visibleStroke',
        points: [{ altitudeDegrees: 90, azimuthDegrees: 0 }],
      },
    ]);

    expect(readBlockedPixel(erased, 20, 20, 10, 10)).toBe(true);
  });
});
