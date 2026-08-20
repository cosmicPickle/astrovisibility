import {
  angularSeparationDegrees,
  angularSizeDegreesToPixelsAtDirection,
  applyPlanetariumPan,
  applyPlanetariumZoom,
  createPlanetariumCamera,
  densifyHorizontalPath,
  getPlanetariumCameraCenter,
  MAXIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES,
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

  it('uses Stellarium-compatible stereographic field-of-view limits', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 90,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: MAXIMUM_PLANETARIUM_FIELD_OF_VIEW_DEGREES,
    });

    expect(camera.fieldOfViewDegrees).toBe(235);
    expect(() =>
      createPlanetariumCamera({
        centerAltitudeDegrees: 90,
        centerAzimuthDegrees: 0,
        fieldOfViewDegrees: 235.01,
      }),
    ).toThrow('fieldOfViewDegrees must be 8..235');
  });

  it('maps a celestial small circle to a screen circle', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 52,
      centerAzimuthDegrees: 37,
      fieldOfViewDegrees: 200,
    });
    const points = [0, 60, 120, 180, 240, 300].map((azimuthDegrees) =>
      projectHorizontalDirection(
        { altitudeDegrees: 25, azimuthDegrees },
        camera,
        canvas,
      ),
    );
    const [first, second, third] = points;
    const determinant =
      2 *
      (first!.xPixels * (second!.yPixels - third!.yPixels) +
        second!.xPixels * (third!.yPixels - first!.yPixels) +
        third!.xPixels * (first!.yPixels - second!.yPixels));
    const squared = (point: (typeof points)[number]) =>
      point.xPixels ** 2 + point.yPixels ** 2;
    const centerX =
      (squared(first!) * (second!.yPixels - third!.yPixels) +
        squared(second!) * (third!.yPixels - first!.yPixels) +
        squared(third!) * (first!.yPixels - second!.yPixels)) /
      determinant;
    const centerY =
      (squared(first!) * (third!.xPixels - second!.xPixels) +
        squared(second!) * (first!.xPixels - third!.xPixels) +
        squared(third!) * (second!.xPixels - first!.xPixels)) /
      determinant;
    const radii = points.map((point) =>
      Math.hypot(point.xPixels - centerX, point.yPixels - centerY),
    );

    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-7);
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

  it('applies Stellarium-style incremental Alt/Az drag without camera roll', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 100,
    });
    const start = { xPixels: 170, yPixels: 430 };
    const current = { xPixels: 178, yPixels: 426 };
    const grabbedDirection = unprojectCanvasPoint(start, camera, canvas)!;
    const next = applyPlanetariumPan(camera, canvas, start, current);
    const projectedAfterPan = projectHorizontalDirection(
      grabbedDirection,
      next,
      canvas,
    );

    expect(projectedAfterPan.xPixels).toBeCloseTo(current.xPixels, 0);
    expect(projectedAfterPan.yPixels).toBeCloseTo(current.yPixels, 0);
    expect(
      angularSeparationDegrees(
        getPlanetariumCameraCenter(camera),
        getPlanetariumCameraCenter(next),
      ),
    ).toBeGreaterThan(1);
  });

  it('matches Stellarium pinch by changing only field of view', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 80,
      fieldOfViewDegrees: 160,
    });
    const centerBefore = getPlanetariumCameraCenter(camera);
    const duringGesture = applyPlanetariumZoom(camera, 2.4);
    const releaseResult = applyPlanetariumZoom(camera, 2.4);

    expect(duringGesture.fieldOfViewDegrees).toBeCloseTo(160 / 2.4, 10);
    expect(getPlanetariumCameraCenter(duringGesture)).toEqual(centerBefore);
    expect(duringGesture.forward).toEqual(camera.forward);
    expect(duringGesture.right).toEqual(camera.right);
    expect(duringGesture.up).toEqual(camera.up);
    expect(releaseResult).toEqual(duringGesture);
  });

  it('uses the stereographic local scale for angular DSO sizes', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 120,
    });
    const centerSize = angularSizeDegreesToPixelsAtDirection(
      1,
      { altitudeDegrees: 45, azimuthDegrees: 180 },
      camera,
      canvas,
    );
    const edgeSize = angularSizeDegreesToPixelsAtDirection(
      1,
      { altitudeDegrees: 45, azimuthDegrees: 230 },
      camera,
      canvas,
    );

    expect(centerSize).toBeCloseTo(3.0229989404, 8);
    expect(edgeSize).toBeGreaterThan(centerSize);
  });

  it('cannot move the camera centre when a pinch centroid jitters', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 80,
      fieldOfViewDegrees: 160,
    });
    const next = applyPlanetariumZoom(camera, 2.4);

    expect(getPlanetariumCameraCenter(next)).toEqual(
      getPlanetariumCameraCenter(camera),
    );
  });

  it('rebuilds a level mount basis after a closed incremental drag trace', () => {
    const initial = createPlanetariumCamera({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 100,
    });
    const points = [
      { xPixels: 200, yPixels: 400 },
      { xPixels: 260, yPixels: 400 },
      { xPixels: 260, yPixels: 460 },
      { xPixels: 200, yPixels: 460 },
      { xPixels: 200, yPixels: 400 },
    ];
    const final = points
      .slice(1)
      .reduce(
        (camera, point, index) =>
          applyPlanetariumPan(camera, canvas, points[index]!, point),
        initial,
      );

    expect(Number.isFinite(final.forward.x)).toBe(true);
    expect(Number.isFinite(final.up.y)).toBe(true);
    expect(Math.hypot(final.right.x, final.right.y, final.right.z)).toBeCloseTo(
      1,
      10,
    );
    expect(final.right.y).toBeCloseTo(0, 10);
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
