import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import {
  angularSeparationDegrees,
  createPlanetariumCamera,
} from './planetariumProjection';
import {
  createPlanetariumPanoramaMesh,
  projectPlanetariumPanoramaMesh,
} from './planetariumPanoramaGeometry';

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
  coveragePolygon: [
    { azimuthDegrees: 0, altitudeDegrees: 65 },
    { azimuthDegrees: 120, altitudeDegrees: 65 },
    { azimuthDegrees: 240, altitudeDegrees: 65 },
  ],
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

  it('omits a tile opposite the camera instead of stretching it across the canvas', () => {
    const mesh = createPlanetariumPanoramaMesh({
      ...upwardTile,
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 180,
    });
    const projection = projectPlanetariumPanoramaMesh(
      mesh,
      createPlanetariumCamera({
        centerAltitudeDegrees: 30,
        centerAzimuthDegrees: 0,
        fieldOfViewDegrees: 100,
      }),
      { widthPixels: 390, heightPixels: 420 },
    );

    expect(projection.indices).toEqual([]);
    expect(projection.vertices).toEqual([]);
  });

  it('keeps visible tile vertices finite and bounded near the canvas', () => {
    const mesh = createPlanetariumPanoramaMesh({
      ...upwardTile,
      centerAltitudeDegrees: 35,
      centerAzimuthDegrees: 15,
    });
    const canvas = { widthPixels: 390, heightPixels: 420 };
    const projection = projectPlanetariumPanoramaMesh(
      mesh,
      createPlanetariumCamera({
        centerAltitudeDegrees: 35,
        centerAzimuthDegrees: 0,
        fieldOfViewDegrees: 100,
      }),
      canvas,
    );

    expect(projection.indices.length).toBeGreaterThan(0);
    expect(projection.indices.length % 3).toBe(0);
    expect(projection.vertices.length).toBe(mesh.directions.length);
    for (const point of projection.vertices) {
      expect(Number.isFinite(point.xPixels)).toBe(true);
      expect(Number.isFinite(point.yPixels)).toBe(true);
      expect(Math.abs(point.xPixels)).toBeLessThan(canvas.widthPixels * 3);
      expect(Math.abs(point.yPixels)).toBeLessThan(canvas.heightPixels * 3);
    }
  });
});
