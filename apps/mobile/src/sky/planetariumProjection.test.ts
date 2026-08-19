import {
  angularSeparationDegrees,
  applyPlanetariumGesture,
  createPlanetariumCamera,
  densifyHorizontalPath,
  getPlanetariumCameraCenter,
  projectHorizontalDirection,
  unprojectCanvasPoint,
} from './planetariumProjection';

const canvas = { widthPixels: 400, heightPixels: 800 };

describe('planetarium spherical camera', () => {
  it('projects the camera direction to the canvas centre', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 120,
    });

    expect(
      projectHorizontalDirection(
        { altitudeDegrees: 45, azimuthDegrees: 180 },
        camera,
        canvas,
      ),
    ).toEqual({ visible: true, xPixels: 200, yPixels: 400 });
  });

  it('renders a 360 degree fisheye with the horizon as a circle around zenith', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 90,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 360,
    });

    const horizon = [0, 90, 180, 270].map((azimuthDegrees) =>
      projectHorizontalDirection(
        { altitudeDegrees: 0, azimuthDegrees },
        camera,
        canvas,
      ),
    );

    for (const point of horizon) {
      expect(point.visible).toBe(true);
      expect(Math.hypot(point.xPixels - 200, point.yPixels - 400)).toBeCloseTo(
        100,
        8,
      );
    }
  });

  it('round-trips arbitrary directions through projection and inverse projection', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 38,
      centerAzimuthDegrees: 342,
      fieldOfViewDegrees: 220,
    });
    const direction = { altitudeDegrees: 61, azimuthDegrees: 27 };
    const point = projectHorizontalDirection(direction, camera, canvas);
    const roundTrip = unprojectCanvasPoint(point, camera, canvas);

    expect(roundTrip).not.toBeNull();
    expect(angularSeparationDegrees(direction, roundTrip!)).toBeLessThan(1e-7);
  });

  it('rotates the actual celestial sphere while keeping the grabbed sky under the finger', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 100,
    });
    const start = { xPixels: 170, yPixels: 430 };
    const current = { xPixels: 290, yPixels: 360 };
    const grabbedDirection = unprojectCanvasPoint(start, camera, canvas)!;
    const next = applyPlanetariumGesture(camera, canvas, {
      currentFocalXPixels: current.xPixels,
      currentFocalYPixels: current.yPixels,
      scale: 1,
      startFocalXPixels: start.xPixels,
      startFocalYPixels: start.yPixels,
    });
    const projectedAfterPan = projectHorizontalDirection(
      grabbedDirection,
      next,
      canvas,
    );

    expect(projectedAfterPan.xPixels).toBeCloseTo(current.xPixels, 7);
    expect(projectedAfterPan.yPixels).toBeCloseTo(current.yPixels, 7);
    expect(
      angularSeparationDegrees(
        getPlanetariumCameraCenter(camera),
        getPlanetariumCameraCenter(next),
      ),
    ).toBeGreaterThan(10);
  });

  it('keeps focal-point sky fixed during pinch and has no release-only camera change', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 80,
      fieldOfViewDegrees: 160,
    });
    const focal = { xPixels: 115, yPixels: 315 };
    const anchoredDirection = unprojectCanvasPoint(focal, camera, canvas)!;
    const gesture = {
      currentFocalXPixels: focal.xPixels,
      currentFocalYPixels: focal.yPixels,
      scale: 2.4,
      startFocalXPixels: focal.xPixels,
      startFocalYPixels: focal.yPixels,
    };
    const duringGesture = applyPlanetariumGesture(camera, canvas, gesture);
    const releaseResult = applyPlanetariumGesture(camera, canvas, gesture);
    const projected = projectHorizontalDirection(
      anchoredDirection,
      duringGesture,
      canvas,
    );

    expect(duringGesture.fieldOfViewDegrees).toBeCloseTo(160 / 2.4, 10);
    expect(projected.xPixels).toBeCloseTo(focal.xPixels, 7);
    expect(projected.yPixels).toBeCloseTo(focal.yPixels, 7);
    expect(releaseResult).toEqual(duringGesture);
  });

  it('projects a north-wrap and zenith-crossing trajectory without an S fold', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 70,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 140,
    });
    const directions = [
      { altitudeDegrees: 84, azimuthDegrees: 350 },
      { altitudeDegrees: 88, azimuthDegrees: 355 },
      { altitudeDegrees: 90, azimuthDegrees: 0 },
      { altitudeDegrees: 88, azimuthDegrees: 175 },
      { altitudeDegrees: 84, azimuthDegrees: 180 },
    ];
    const points = directions.map((direction) =>
      projectHorizontalDirection(direction, camera, canvas),
    );

    expect(points.every(({ visible }) => visible)).toBe(true);
    for (let index = 1; index < points.length; index += 1) {
      expect(
        Math.hypot(
          points[index]!.xPixels - points[index - 1]!.xPixels,
          points[index]!.yPixels - points[index - 1]!.yPixels,
        ),
      ).toBeLessThan(35);
    }
  });

  it('densifies seam-crossing spherical boundaries along the short arc', () => {
    const path = densifyHorizontalPath(
      [
        { altitudeDegrees: 35, azimuthDegrees: 358 },
        { altitudeDegrees: 35, azimuthDegrees: 2 },
      ],
      0.5,
    );

    expect(path.length).toBeGreaterThan(2);
    expect(
      Math.max(
        ...path
          .slice(1)
          .map((point, index) => angularSeparationDegrees(path[index]!, point)),
      ),
    ).toBeLessThanOrEqual(0.51);
    expect(path.some((point) => point.azimuthDegrees > 359)).toBe(true);
    expect(path.some((point) => point.azimuthDegrees < 1)).toBe(true);
  });
});
