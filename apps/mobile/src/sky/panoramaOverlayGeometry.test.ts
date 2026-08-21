import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import { createSkyViewport } from './skyViewport';
import {
  createPanoramaEditorViewport,
  projectPanoramaTilesToViewport,
} from './panoramaOverlayGeometry';

const canvas = { widthPixels: 360, heightPixels: 180 };
const tile: ActivePanoramaTile = {
  id: 'tile-1',
  uri: 'file:///panorama/tile-1.jpg',
  centerAzimuthDegrees: 0,
  centerAltitudeDegrees: 45,
  rollDegrees: 2,
  horizontalFieldOfViewDegrees: 60,
  verticalFieldOfViewDegrees: 40,
  widthPixels: 1600,
  heightPixels: 1200,
  coveragePolygon: [
    { azimuthDegrees: -30, altitudeDegrees: 25 },
    { azimuthDegrees: 30, altitudeDegrees: 25 },
    { azimuthDegrees: 30, altitudeDegrees: 65 },
  ],
};

describe('panorama Sky View overlay projection', () => {
  it('fits a partial panorama instead of opening at a thin full-sky scale', () => {
    const viewport = createPanoramaEditorViewport([
      tile,
      { ...tile, id: 'tile-2', centerAzimuthDegrees: 55 },
    ]);

    expect(viewport.centerAzimuthDegrees).toBeCloseTo(27.5, 5);
    expect(viewport.centerAltitudeDegrees).toBeCloseTo(45, 5);
    expect(viewport.horizontalSpanDegrees).toBeGreaterThanOrEqual(80);
    expect(viewport.horizontalSpanDegrees).toBeLessThan(180);
  });

  it('fits coverage crossing north around the seam', () => {
    const viewport = createPanoramaEditorViewport([
      { ...tile, centerAzimuthDegrees: 350 },
      { ...tile, id: 'tile-2', centerAzimuthDegrees: 10 },
    ]);

    expect(
      Math.min(
        Math.abs(viewport.centerAzimuthDegrees),
        Math.abs(viewport.centerAzimuthDegrees - 360),
      ),
    ).toBeLessThan(1);
    expect(viewport.horizontalSpanDegrees).toBeLessThan(180);
  });

  it('keeps a full panorama at a usable drawing zoom', () => {
    const viewport = createPanoramaEditorViewport(
      Array.from({ length: 8 }, (_, index) => ({
        ...tile,
        id: `tile-${index}`,
        centerAzimuthDegrees: index * 45,
      })),
    );

    expect(viewport.centerAzimuthDegrees).toBe(0);
    expect(viewport.horizontalSpanDegrees).toBe(120);
  });

  it('renders seam-crossing copies at both sides of a full-sky viewport', () => {
    const projected = projectPanoramaTilesToViewport(
      [tile],
      createSkyViewport({
        centerAzimuthDegrees: 180,
        centerAltitudeDegrees: 45,
        horizontalSpanDegrees: 360,
      }),
      canvas,
    );

    expect(projected).toHaveLength(2);
    expect(projected.map((item) => item.centerXPixels)).toEqual([0, 360]);
    expect(projected[0]).toMatchObject({
      centerYPixels: 90,
      widthPixels: 60,
      heightPixels: 80,
      rotationDegrees: 2,
    });
  });

  it('keeps upward tiles aligned while zooming and omits off-viewport tiles', () => {
    const viewport = createSkyViewport({
      centerAzimuthDegrees: 10,
      centerAltitudeDegrees: 75,
      horizontalSpanDegrees: 90,
    });
    const projected = projectPanoramaTilesToViewport(
      [
        { ...tile, centerAzimuthDegrees: 10, centerAltitudeDegrees: 82 },
        { ...tile, id: 'offscreen', centerAzimuthDegrees: 180 },
      ],
      viewport,
      canvas,
    );

    expect(projected).toHaveLength(1);
    expect(projected[0].tileId).toBe('tile-1');
    expect(projected[0].centerYPixels).toBeLessThan(90);
  });
});
