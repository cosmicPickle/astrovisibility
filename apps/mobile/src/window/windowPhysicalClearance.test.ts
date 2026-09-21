import { createImagingFrame } from '../astronomy/imagingFrame';
import { horizontalDirectionToVector } from '../sky/planetariumProjection';
import { createWindowGeometry, windowContainsRay } from './windowGeometry';
import { windowContainsFrame } from './windowFrame';
import { wallRayIsClear } from './__fixtures__/wallIntersection';

const range = Math.hypot(0.6, 0.1);
const halfAngle = (Math.atan2(0.6, 0.1) * 180) / Math.PI;
const geometry = createWindowGeometry({
  version: 1,
  leftAzimuthDegrees: 360 - halfAngle,
  rightAzimuthDegrees: halfAngle,
  topSlope: 0.6 / range,
  bottomSlope: -0.6 / range,
  rightDistanceRatio: 1,
  widthMeters: 1.2,
});
const direction = (azimuthDegrees: number, altitudeDegrees = 0) =>
  horizontalDirectionToVector({ azimuthDegrees, altitudeDegrees });
const frameAt = (azimuth: number, width = 1, altitude = 0) =>
  createImagingFrame({
    horizontalFovDegrees: width,
    verticalFovDegrees: 1,
    orientationDegrees: 0,
    trackingMode: 'altaz',
    observerLatitudeDegrees: 44,
    horizontal: {
      azimuthDegreesClockwiseFromNorth: azimuth,
      refractedAltitudeDegrees: altitude,
    },
  });

it('tests the actual forward wall intersection from in front of the window', () => {
  const lens = { x: 0, y: 0, z: 0.2 };
  // At 95 degrees, x=1.143 m hits the wall; at 105, x=0.373 m passes the opening.
  expect(windowContainsRay(geometry, direction(95), lens)).toBe(false);
  expect(windowContainsRay(geometry, direction(105), lens)).toBe(true);
  expect(windowContainsFrame(geometry, frameAt(95), lens, 35)).toBe(false);
  expect(windowContainsFrame(geometry, frameAt(105), lens, 35)).toBe(true);
  expect(windowContainsFrame(geometry, frameAt(0), lens, 35)).toBe(true);
});

it('blocks an interior wall strip even when the centre and four corners clear', () => {
  const lens = { x: 0, y: 0, z: 0.2 };
  const frame = frameAt(80, 60);
  expect(
    [frame.center, ...frame.corners].every((ray) =>
      windowContainsRay(geometry, ray, lens),
    ),
  ).toBe(true);
  expect(windowContainsFrame(geometry, frame, lens, 35)).toBe(false);
});

it('keeps contact and plane-straddling pupil checks finite and physical', () => {
  expect(
    windowContainsFrame(geometry, frameAt(0), { x: 0, y: 0, z: 0.1 }, 35),
  ).toBe(true);
  expect(
    windowContainsFrame(geometry, frameAt(0), { x: 0.59, y: 0, z: 0.1 }, 35),
  ).toBe(false);
  expect(
    windowContainsFrame(geometry, frameAt(89), { x: 0, y: 0, z: 0.1 }, 35),
  ).toBe(false);
  expect(
    windowContainsFrame(geometry, frameAt(180), { x: 0, y: 0, z: 0.1 }, 35),
  ).toBe(false);
  expect(
    windowContainsFrame(geometry, frameAt(0), { x: 0.5825, y: 0, z: 0.1 }, 35),
  ).toBe(false);
});

it('rejects invalid pupil diameters instead of treating them as clear', () => {
  for (const diameter of [-1, NaN, Infinity])
    expect(() =>
      windowContainsFrame(geometry, frameAt(0), { x: 0, y: 0, z: 0 }, diameter),
    ).toThrow();
});

it.each(['altaz', 'equatorial', 'derotatedAltaz'] as const)(
  'never clears a sampled physical wall hit across pupil positions in %s mode',
  (trackingMode) => {
    let checked = 0;
    const failures: unknown[] = [];
    for (const azimuth of [0, 45, 80, 89, 91, 100, 135, 180, 240, 280, 359])
      for (const altitude of [0, 30, 75])
        for (const lensX of [0, 0.55, 0.65])
          for (const lensZ of [0, 0.095, 0.1, 0.105, 0.2]) {
            const lens = { x: lensX, y: 0, z: lensZ };
            const frame = createImagingFrame({
              horizontalFovDegrees: 6,
              verticalFovDegrees: 4,
              orientationDegrees: 37,
              trackingMode,
              observerLatitudeDegrees: 44,
              horizontal: {
                azimuthDegreesClockwiseFromNorth: azimuth,
                refractedAltitudeDegrees: altitude,
              },
            });
            const actual = windowContainsFrame(geometry, frame, lens, 35);
            if (!actual) continue;
            const rays = [frame.center, ...frame.corners];
            for (let angle = 0; angle < 64; angle++) {
              const theta = (angle * 2 * Math.PI) / 64;
              const point = {
                x:
                  lens.x +
                  0.0175 *
                    (Math.cos(theta) * frame.right.x +
                      Math.sin(theta) * frame.up.x),
                y:
                  lens.y +
                  0.0175 *
                    (Math.cos(theta) * frame.right.y +
                      Math.sin(theta) * frame.up.y),
                z:
                  lens.z +
                  0.0175 *
                    (Math.cos(theta) * frame.right.z +
                      Math.sin(theta) * frame.up.z),
              };
              if (
                rays.some(
                  (ray) =>
                    !wallRayIsClear(ray, point, 0.1, -0.6, 0.6, -0.6, 0.6),
                ) &&
                failures.length < 5
              )
                failures.push({ azimuth, altitude, lensX, lensZ, angle });
            }
            checked++;
          }
    expect(checked).toBeGreaterThan(100);
    expect(failures).toEqual([]);
  },
);
