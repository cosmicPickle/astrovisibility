import {
  createWindowGeometry,
  moveWindowCorner,
  windowContainsRay,
  lensPositionMeters,
  type WindowDefinition,
} from './windowGeometry';
import {
  horizontalDirectionToVector,
  vectorToHorizontalDirection,
} from '../sky/planetariumProjection';

const front: WindowDefinition = {
  version: 1,
  leftAzimuthDegrees: 330,
  rightAzimuthDegrees: 30,
  topSlope: 0.6,
  bottomSlope: -0.2,
  rightDistanceRatio: 1,
  widthMeters: 2,
};
describe('physical window geometry', () => {
  it('recovers analytic distance and height from calibrated rays and width', () => {
    const geometry = createWindowGeometry(front);
    expect(geometry.distanceMeters).toBeCloseTo(
      2 / (2 * Math.tan(Math.PI / 6)),
      10,
    );
    expect(geometry.heightMeters).toBeCloseTo(1.6, 10);
    expect(windowContainsRay(geometry, { x: 0, y: 0, z: 1 })).toBe(true);
    expect(windowContainsRay(geometry, { x: 0, y: 0, z: -1 })).toBe(false);
    expect(windowContainsRay(geometry, geometry.corners[0]!)).toBe(false);
  });
  it('reconstructs an oblique rectangle and preserves scale invariance', () => {
    const definition = { ...front, rightDistanceRatio: 1.7 };
    const geometry = createWindowGeometry(definition);
    const scaled = createWindowGeometry({ ...definition, widthMeters: 4 });
    expect(scaled.distanceMeters).toBeCloseTo(geometry.distanceMeters * 2);
    expect(scaled.heightMeters).toBeCloseTo(geometry.heightMeters * 2);
    const ray = horizontalDirectionToVector({
      azimuthDegrees: 20,
      altitudeDegrees: 5,
    });
    expect(windowContainsRay(geometry, ray, { x: 0.3, y: 0, z: 0 })).toBe(
      windowContainsRay(scaled, ray, { x: 0.6, y: 0, z: 0 }),
    );
    expect(geometry.corners[0]!.y).toBeCloseTo(geometry.corners[1]!.y);
    expect(geometry.corners[2]!.y).toBeCloseTo(geometry.corners[3]!.y);
  });
  it('moves linked corners as an upright physical rectangle across north', () => {
    const moved = moveWindowCorner(front, 1, {
      azimuthDegrees: 40,
      altitudeDegrees: 20,
    });
    const geometry = createWindowGeometry(moved);
    const corner = vectorToHorizontalDirection(geometry.corners[1]!);
    expect(corner.azimuthDegrees).toBeCloseTo(40);
    expect(corner.altitudeDegrees).toBeCloseTo(20);
    expect(geometry.corners[0]!.y).toBeCloseTo(geometry.corners[1]!.y);
    expect(geometry.corners[2]!.y).toBeCloseTo(geometry.corners[3]!.y);
  });
  it('models opposite lens offsets and keeps field correction on the AltAz mount', () => {
    const geometry = createWindowGeometry(front);
    const direction = { azimuthDegrees: 29, altitudeDegrees: 5 };
    const ray = horizontalDirectionToVector(direction);
    const right = lensPositionMeters(direction, 300, 'altaz', 45);
    const left = lensPositionMeters(direction, -300, 'altaz', 45);
    expect(windowContainsRay(geometry, ray, right)).toBe(false);
    expect(windowContainsRay(geometry, ray, left)).toBe(true);
    expect(lensPositionMeters(direction, 300, 'derotatedAltaz', 45)).toEqual(
      right,
    );
    expect(lensPositionMeters(direction, 300, 'equatorial', 45)).not.toEqual(
      right,
    );
    expect(lensPositionMeters(direction, 0, 'equatorial', 45)).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });
  it('rejects invalid, collapsed, inverted, grazing and behind-lens geometry', () => {
    for (const changes of [
      { widthMeters: 0 },
      { widthMeters: NaN },
      { rightDistanceRatio: -1 },
      { rightAzimuthDegrees: 330 },
      { bottomSlope: 1 },
    ]) {
      expect(() => createWindowGeometry({ ...front, ...changes })).toThrow();
    }
    expect(
      windowContainsRay(createWindowGeometry(front), { x: 1, y: 0, z: 0 }),
    ).toBe(false);
    expect(
      windowContainsRay(
        createWindowGeometry(front),
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: 10 },
      ),
    ).toBe(false);
  });
});
