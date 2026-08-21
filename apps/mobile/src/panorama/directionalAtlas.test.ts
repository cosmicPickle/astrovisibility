import {
  atlasPixelToDirection,
  directionToAtlasPixel,
  isAtlasPixelInsideHemisphere,
  projectPanoramaMeshToDirectionalAtlas,
} from './directionalAtlas';

describe('upper-hemisphere directional atlas', () => {
  const size = { heightPixels: 2048, widthPixels: 2048 };

  it('places zenith at the centre and cardinal horizon directions on the rim', () => {
    expect(
      directionToAtlasPixel({ altitudeDegrees: 90, azimuthDegrees: 0 }, size),
    ).toEqual({
      xPixels: 1024,
      yPixels: 1024,
    });
    expect(
      directionToAtlasPixel({ altitudeDegrees: 0, azimuthDegrees: 0 }, size),
    ).toEqual({
      xPixels: 1024,
      yPixels: 0,
    });
    const east = directionToAtlasPixel(
      { altitudeDegrees: 0, azimuthDegrees: 90 },
      size,
    );
    expect(east.xPixels).toBeCloseTo(2048, 9);
    expect(east.yPixels).toBeCloseTo(1024, 9);
  });

  it('round-trips arbitrary sky directions', () => {
    const direction = { altitudeDegrees: 37.25, azimuthDegrees: 312.5 };
    const restored = atlasPixelToDirection(
      directionToAtlasPixel(direction, size),
      size,
    );

    expect(restored?.altitudeDegrees).toBeCloseTo(direction.altitudeDegrees, 9);
    expect(restored?.azimuthDegrees).toBeCloseTo(direction.azimuthDegrees, 9);
  });

  it('rejects square-corner pixels outside the hemisphere', () => {
    expect(isAtlasPixelInsideHemisphere({ xPixels: 0, yPixels: 0 }, size)).toBe(
      false,
    );
    expect(atlasPixelToDirection({ xPixels: 0, yPixels: 0 }, size)).toBeNull();
  });

  it('clips panorama triangles at the horizon instead of rejecting horizon-level captures', () => {
    const projected = projectPanoramaMeshToDirectionalAtlas(
      {
        angularRadiusDegrees: 10,
        centerDirection: { altitudeDegrees: 0, azimuthDegrees: 5 },
        columnCount: 3,
        directions: [
          { altitudeDegrees: 5, azimuthDegrees: 0 },
          { altitudeDegrees: -5, azimuthDegrees: 5 },
          { altitudeDegrees: 5, azimuthDegrees: 10 },
        ],
        indices: [0, 1, 2],
        rowCount: 1,
        texturePointsPixels: [
          { x: 0, y: 0 },
          { x: 50, y: 100 },
          { x: 100, y: 0 },
        ],
      },
      size,
    );

    expect(projected.indices).toHaveLength(6);
    expect(projected.positions).toHaveLength(4);
    expect(projected.texturePointsPixels).toHaveLength(4);
    expect(
      projected.positions.every((point) =>
        isAtlasPixelInsideHemisphere(point, size),
      ),
    ).toBe(true);
  });

  it('omits panorama triangles that are entirely below the horizon', () => {
    const projected = projectPanoramaMeshToDirectionalAtlas(
      {
        angularRadiusDegrees: 10,
        centerDirection: { altitudeDegrees: -10, azimuthDegrees: 5 },
        columnCount: 3,
        directions: [
          { altitudeDegrees: -5, azimuthDegrees: 0 },
          { altitudeDegrees: -10, azimuthDegrees: 5 },
          { altitudeDegrees: -5, azimuthDegrees: 10 },
        ],
        indices: [0, 1, 2],
        rowCount: 1,
        texturePointsPixels: [
          { x: 0, y: 0 },
          { x: 50, y: 100 },
          { x: 100, y: 0 },
        ],
      },
      size,
    );

    expect(projected).toEqual({
      indices: [],
      positions: [],
      texturePointsPixels: [],
    });
  });
});
