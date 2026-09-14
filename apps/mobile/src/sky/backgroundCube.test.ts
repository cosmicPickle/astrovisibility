import { equatorialJ2000ToHorizontal } from '../astronomy/horizontalCoordinates';
import {
  horizontalDirectionToVector,
  createPlanetariumCamera,
  unprojectCanvasPoint,
} from './planetariumProjection';
import {
  cubeDirection,
  cubeUv,
  screenDirection,
  createCelestialCubeOrientation,
  observedToJ2000,
  createInverseRefractionTable,
  sampleInverseRefraction,
} from './backgroundCube';

const canvas = { widthPixels: 1080, heightPixels: 2200 };
const distance = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('cube background geometry', () => {
  it('keeps six independent axis directions and face centres', () => {
    const axes = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
    ];
    axes.forEach((axis, face) => {
      expect(distance(cubeDirection(face, 0.5, 0.5), axis)).toBeLessThan(1e-12);
      expect(cubeUv(axis)).toEqual({ face, u: 0.5, v: 0.5 });
    });
  });
  it('round trips face edges, corners and padded coordinates without seams', () => {
    for (let face = 0; face < 6; face++)
      for (const u of [-0.002, 0, 0.001, 0.3, 0.5, 0.999, 1, 1.002])
        for (const v of [0, 0.17, 0.5, 1]) {
          const ray = cubeDirection(face, u, v);
          const uv = cubeUv(ray);
          expect(
            distance(cubeDirection(uv.face, uv.u, uv.v), ray),
          ).toBeLessThan(1e-12);
        }
  });
  it('matches the existing inverse projection at all supported zooms and poles', () => {
    for (const altitude of [-90, -1, 0, 35, 89.999, 90])
      for (const fov of [0.25, 10, 100, 235]) {
        const camera = createPlanetariumCamera({
          centerAltitudeDegrees: altitude,
          centerAzimuthDegrees: 359.99,
          fieldOfViewDegrees: fov,
        });
        for (const point of [
          { xPixels: 0, yPixels: 0 },
          { xPixels: 540, yPixels: 1100 },
          { xPixels: 1080, yPixels: 2200 },
          { xPixels: 810, yPixels: 120 },
        ]) {
          expect(
            distance(
              screenDirection(point, camera, canvas),
              horizontalDirectionToVector(
                unprojectCanvasPoint(point, camera, canvas)!,
              ),
            ),
          ).toBeLessThan(1e-10);
        }
      }
  });
});

describe('Milky Way registration', () => {
  const table = createInverseRefractionTable();
  it('preserves authoritative celestial positions across dates, latitudes and the horizon', () => {
    let maximumErrorDegrees = 0;
    for (const latitude of [-80, -33, 0, 42, 80])
      for (const date of ['2026-03-20T00:00:00Z', '2026-09-14T18:00:00Z']) {
        const observer = {
          latitudeDegreesNorth: latitude,
          longitudeDegreesEast: 23,
          elevationMetersAboveMeanSeaLevel: 100,
        };
        const orientation = createCelestialCubeOrientation({
          observer,
          timestampUtc: date,
        });
        for (let ra = 0; ra < 24; ra += 1.25)
          for (const dec of [-89.99, -60, -15, 0, 45, 89.99]) {
            const horizontal = equatorialJ2000ToHorizontal({
              observer,
              timestampUtc: date,
              rightAscensionJ2000Hours: ra,
              declinationJ2000Degrees: dec,
            });
            const observed = horizontalDirectionToVector({
              altitudeDegrees: horizontal.refractedAltitudeDegrees,
              azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
            });
            const restored = observedToJ2000(
              observed,
              orientation,
              sampleInverseRefraction(table, observed.y),
            );
            const expected = {
              x:
                Math.cos((dec * Math.PI) / 180) * Math.cos((ra * Math.PI) / 12),
              y:
                Math.cos((dec * Math.PI) / 180) * Math.sin((ra * Math.PI) / 12),
              z: Math.sin((dec * Math.PI) / 180),
            };
            maximumErrorDegrees = Math.max(
              maximumErrorDegrees,
              (2 * Math.asin(distance(restored, expected) / 2) * 180) / Math.PI,
            );
          }
      }
    expect(maximumErrorDegrees).toBeLessThan(0.01);
  });
});
