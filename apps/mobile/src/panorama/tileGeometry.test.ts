import { createTileCoveragePolygon } from './tileGeometry';
import {
  classifyMaskDirection,
  createVisibilityMask,
} from '../mask/visibilityMask';

describe('direction-aware panorama tile geometry', () => {
  it('clips a low camera footprint to the astronomical horizon', () => {
    const polygon = createTileCoveragePolygon({
      centerAzimuthDegrees: 0,
      centerAltitudeDegrees: 0,
      horizontalFieldOfViewDegrees: 55,
      rollDegrees: 0,
      verticalFieldOfViewDegrees: 69,
    });

    expect(polygon.length).toBeGreaterThan(20);
    expect(Math.min(...polygon.map((point) => point.altitudeDegrees))).toBe(0);
    expect(
      polygon.every(
        ({ altitudeDegrees }) => altitudeDegrees >= 0 && altitudeDegrees <= 90,
      ),
    ).toBe(true);
    expect(
      Math.max(...polygon.map((point) => point.altitudeDegrees)),
    ).toBeCloseTo(34.5, 0);
  });

  it('uses roll when projecting the camera rectangle onto the sky', () => {
    const unrolled = createTileCoveragePolygon({
      centerAzimuthDegrees: 180,
      centerAltitudeDegrees: 45,
      horizontalFieldOfViewDegrees: 60,
      rollDegrees: 0,
      verticalFieldOfViewDegrees: 30,
    });
    const rolled = createTileCoveragePolygon({
      centerAzimuthDegrees: 180,
      centerAltitudeDegrees: 45,
      horizontalFieldOfViewDegrees: 60,
      rollDegrees: 90,
      verticalFieldOfViewDegrees: 30,
    });

    const azimuthSpan = (polygon: typeof rolled) =>
      Math.max(...polygon.map((point) => point.azimuthDegrees)) -
      Math.min(...polygon.map((point) => point.azimuthDegrees));
    const altitudeSpan = (polygon: typeof rolled) =>
      Math.max(...polygon.map((point) => point.altitudeDegrees)) -
      Math.min(...polygon.map((point) => point.altitudeDegrees));
    expect(azimuthSpan(rolled)).toBeLessThan(azimuthSpan(unrolled));
    expect(altitudeSpan(rolled)).toBeGreaterThan(altitudeSpan(unrolled));
  });

  it('preserves a continuous boundary when coverage surrounds the zenith', () => {
    const polygon = createTileCoveragePolygon({
      centerAzimuthDegrees: 90,
      centerAltitudeDegrees: 80,
      horizontalFieldOfViewDegrees: 55,
      rollDegrees: 0,
      verticalFieldOfViewDegrees: 69,
    });

    expect(
      Math.max(...polygon.map((point) => point.altitudeDegrees)),
    ).toBeGreaterThan(89);
    expect(
      Math.max(...polygon.map((point) => point.azimuthDegrees)) -
        Math.min(...polygon.map((point) => point.azimuthDegrees)),
    ).toBeGreaterThan(300);
    const mask = createVisibilityMask(
      [polygon],
      [{ id: 'zenith-region', kind: 'visiblePolygon', points: polygon }],
    );
    expect(
      classifyMaskDirection(mask, {
        altitudeDegrees: 90,
        azimuthDegrees: 0,
      }),
    ).toBe('visible');
    polygon.forEach((point, index) => {
      if (index === 0) return;
      expect(
        Math.abs(point.azimuthDegrees - polygon[index - 1]!.azimuthDegrees),
      ).toBeLessThan(20);
    });
  });
});
