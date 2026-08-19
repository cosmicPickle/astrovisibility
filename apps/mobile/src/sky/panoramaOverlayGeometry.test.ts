import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import { createSkyViewport } from './skyViewport';
import { projectPanoramaTilesToViewport } from './panoramaOverlayGeometry';

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
};

describe('panorama Sky View overlay projection', () => {
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
