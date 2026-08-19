import { createTileCoveragePolygon } from './tileGeometry';

describe('direction-aware panorama tile geometry', () => {
  it('represents a tile crossing north without splitting the data model', () => {
    expect(
      createTileCoveragePolygon({
        centerAzimuthDegrees: 358,
        centerAltitudeDegrees: 30,
        horizontalFieldOfViewDegrees: 20,
        verticalFieldOfViewDegrees: 40,
      }),
    ).toEqual([
      { azimuthDegrees: 348, altitudeDegrees: 10 },
      { azimuthDegrees: 368, altitudeDegrees: 10 },
      { azimuthDegrees: 368, altitudeDegrees: 50 },
      { azimuthDegrees: 348, altitudeDegrees: 50 },
    ]);
  });

  it('clamps upward coverage at the zenith', () => {
    const polygon = createTileCoveragePolygon({
      centerAzimuthDegrees: 90,
      centerAltitudeDegrees: 84,
      horizontalFieldOfViewDegrees: 50,
      verticalFieldOfViewDegrees: 24,
    });

    expect(Math.max(...polygon.map((point) => point.altitudeDegrees))).toBe(90);
    expect(Math.min(...polygon.map((point) => point.altitudeDegrees))).toBe(72);
  });
});
