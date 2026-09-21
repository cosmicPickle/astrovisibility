import { createPlanetariumCamera } from '../sky/planetariumProjection';
import { createWindowGeometry } from './windowGeometry';
import { projectWindowPoint } from './windowProjection';

const camera = createPlanetariumCamera({
  centerAzimuthDegrees: 0,
  centerAltitudeDegrees: 0,
  fieldOfViewDegrees: 210,
});
const canvas = { widthPixels: 360, heightPixels: 300 };

it('breaks an outline at a flush horizon edge instead of normalizing its zero vector', () => {
  const geometry = createWindowGeometry({
    version: 1,
    leftAzimuthDegrees: 270,
    rightAzimuthDegrees: 90,
    topSlope: 1,
    bottomSlope: 0,
    rightDistanceRatio: 1,
    widthMeters: 1,
  });
  const left = geometry.corners[3]!;
  const right = geometry.corners[2]!;
  expect(
    projectWindowPoint(
      {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2,
        z: (left.z + right.z) / 2,
      },
      camera,
      canvas,
    ),
  ).toBeNull();
});

it('also breaks a translated outline when the lens coincides with a corner', () => {
  expect(projectWindowPoint({ x: 0, y: 0, z: 0 }, camera, canvas)).toBeNull();
  expect(
    projectWindowPoint({ x: 1e-9, y: 0, z: 0 }, camera, canvas),
  ).toBeNull();
});

it('projects a finite edge point into the same spherical view', () => {
  expect(
    projectWindowPoint({ x: 0, y: 0, z: 0.5 }, camera, canvas),
  ).toMatchObject({ xPixels: 180, yPixels: 150, visible: true });
});
