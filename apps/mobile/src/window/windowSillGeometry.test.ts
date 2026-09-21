import {
  createWindowGeometry,
  moveWindowCorner,
  windowContainsRay,
  windowPlanesAtLens,
  type WindowDefinition,
} from './windowGeometry';
import {
  horizontalDirectionToVector,
  vectorToHorizontalDirection,
} from '../sky/planetariumProjection';

const radians = Math.PI / 180;
function opening(distanceMeters: number): WindowDefinition {
  const halfAngle = Math.atan2(0.5, distanceMeters) / radians;
  const range = Math.hypot(0.5, distanceMeters);
  return {
    version: 1,
    leftAzimuthDegrees: 360 - halfAngle,
    rightAzimuthDegrees: halfAngle,
    topSlope: 0.5 / range,
    bottomSlope: -0.5 / range,
    rightDistanceRatio: 1,
    widthMeters: 1,
  };
}
const ray = (azimuthDegrees: number, altitudeDegrees = 0) =>
  horizontalDirectionToVector({ azimuthDegrees, altitudeDegrees });

describe('window-sill positions', () => {
  it.each([160.01, 170, 179.9, 180, 180.1, 200, 270])(
    'accepts and reconstructs a %s-degree opening',
    (span) => {
      const distance = 0.5 / Math.tan((span * radians) / 2);
      const geometry = createWindowGeometry(opening(distance));
      expect(geometry.distanceMeters).toBeCloseTo(distance, 10);
      expect(geometry.heightMeters).toBeCloseTo(1, 10);
      expect(windowContainsRay(geometry, ray(0))).toBe(true);
      expect(windowContainsRay(geometry, ray(180))).toBe(false);
      expect(windowContainsRay(geometry, ray(span / 2 - 0.01))).toBe(true);
      expect(windowContainsRay(geometry, ray(span / 2 + 0.01))).toBe(false);
    },
  );

  it.each([0.05, 0, -0.05])(
    'matches independent horizontal angle bounds at signed distance %s m',
    (distance) => {
      const geometry = createWindowGeometry(opening(0.05));
      const lens = { x: 0, y: 0, z: 0.05 - distance };
      const limit = Math.atan2(0.5, distance) / radians;
      for (let azimuth = -179.5; azimuth < 180; azimuth += 0.5) {
        expect(windowContainsRay(geometry, ray(azimuth), lens)).toBe(
          Math.abs(azimuth) < limit,
        );
      }
      expect(
        windowPlanesAtLens(geometry, lens).every((plane) =>
          Object.values(plane).every(Number.isFinite),
        ),
      ).toBe(true);
    },
  );

  it('keeps a finite outward hemisphere at a symmetric flush origin', () => {
    const geometry = createWindowGeometry(opening(0));
    expect(windowContainsRay(geometry, ray(0, 80))).toBe(true);
    expect(windowContainsRay(geometry, ray(180, 80))).toBe(false);
    expect(windowContainsRay(geometry, ray(90))).toBe(false);
    expect(windowContainsRay(geometry, ray(0), { x: 0.5, y: 0, z: 0 })).toBe(
      false,
    );
    expect(
      windowContainsRay(geometry, ray(0), { x: 0.5 - 1e-8, y: 0, z: 0 }),
    ).toBe(false);
  });

  it.each([179.9, 180, 200])(
    'keeps oblique %s-degree windows invariant under rotation and scale',
    (span) => {
      const base = opening(0.5 / Math.tan((span * radians) / 2));
      const definition = { ...base, rightDistanceRatio: 1.7 };
      const geometry = createWindowGeometry(definition);
      const rotated = createWindowGeometry({
        ...definition,
        leftAzimuthDegrees: (definition.leftAzimuthDegrees + 75) % 360,
        rightAzimuthDegrees: (definition.rightAzimuthDegrees + 75) % 360,
        widthMeters: 2,
      });
      expect(rotated.distanceMeters).toBeCloseTo(
        2 * geometry.distanceMeters,
        9,
      );
      for (let azimuth = 0; azimuth < 360; azimuth += 5)
        expect(windowContainsRay(rotated, ray(azimuth + 75, 10))).toBe(
          windowContainsRay(geometry, ray(azimuth, 10)),
        );
    },
  );

  it.each([0, 1, 2, 3])(
    'lets corner %s resize its row through the horizon',
    (corner) => {
      let draft = opening(0.5);
      for (const altitudeDegrees of [-2, -0.1, 0, 0.1, 2]) {
        const altitude = corner < 2 ? -altitudeDegrees : altitudeDegrees;
        const direction = {
          azimuthDegrees: corner === 0 || corner === 3 ? 315 : 45,
          altitudeDegrees: altitude,
        };
        draft = moveWindowCorner(draft, corner, direction);
        const geometry = createWindowGeometry(draft);
        const moved = vectorToHorizontalDirection(geometry.corners[corner]!);
        expect(moved.azimuthDegrees).toBeCloseTo(direction.azimuthDegrees, 8);
        expect(moved.altitudeDegrees).toBeCloseTo(direction.altitudeDegrees, 8);
        expect(geometry.corners[0]!.y).toBeCloseTo(geometry.corners[1]!.y, 10);
        expect(geometry.corners[2]!.y).toBeCloseTo(geometry.corners[3]!.y, 10);
      }
    },
  );

  it('drags continuously across 180 degrees and north wrap', () => {
    let draft = { ...opening(0.05), leftAzimuthDegrees: 270 };
    for (const azimuthDegrees of [89.9, 90, 90.1, 100]) {
      draft = moveWindowCorner(draft, 1, {
        azimuthDegrees,
        altitudeDegrees: 20,
      });
      expect(createWindowGeometry(draft).distanceMeters).toEqual(
        expect.any(Number),
      );
    }
    expect(createWindowGeometry(draft).distanceMeters).toBeLessThan(0);
  });
});
