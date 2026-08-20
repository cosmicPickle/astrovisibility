import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import { angularSeparationDegrees } from './planetariumProjection';
import { createPlanetariumPanoramaMesh } from './planetariumPanoramaGeometry';

const upwardTile: ActivePanoramaTile = {
  id: 'upward',
  uri: 'file:///upward.jpg',
  centerAzimuthDegrees: 0,
  centerAltitudeDegrees: 90,
  rollDegrees: 0,
  horizontalFieldOfViewDegrees: 60,
  verticalFieldOfViewDegrees: 45,
  widthPixels: 1600,
  heightPixels: 1200,
};

describe('planetarium panorama mesh', () => {
  it('maps an upward rectilinear tile onto distinct spherical directions', () => {
    const mesh = createPlanetariumPanoramaMesh(upwardTile);
    const center = mesh.directions[Math.floor(mesh.directions.length / 2)]!;
    const topLeft = mesh.directions[0]!;
    const topRight = mesh.directions[mesh.columnCount - 1]!;

    expect(center.altitudeDegrees).toBeCloseTo(90, 7);
    expect(angularSeparationDegrees(topLeft, topRight)).toBeGreaterThan(30);
    expect(topLeft.altitudeDegrees).toBeLessThan(90);
    expect(topRight.altitudeDegrees).toBeLessThan(90);
  });

  it('uses bounded five-degree-or-finer tessellation for wide tiles', () => {
    const mesh = createPlanetariumPanoramaMesh({
      ...upwardTile,
      centerAltitudeDegrees: 35,
      horizontalFieldOfViewDegrees: 120,
      verticalFieldOfViewDegrees: 70,
    });

    expect(mesh.columnCount).toBeGreaterThanOrEqual(25);
    expect(mesh.rowCount).toBeGreaterThanOrEqual(15);
    expect(mesh.columnCount).toBeLessThanOrEqual(33);
    expect(mesh.rowCount).toBeLessThanOrEqual(33);
  });
});
