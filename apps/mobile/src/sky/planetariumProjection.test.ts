import {
  angularSeparationDegrees,
  angularSizeDegreesToPixelsAtDirection,
  applyPlanetariumPan,
  applyPlanetariumZoom,
  createInitialPlanetariumCamera,
  createPlanetariumCamera,
  createEquatorialMountFrame,
  createEquatorialPlanetariumCamera,
  densifyHorizontalPath,
  getPlanetariumCameraCenter,
  mountDirectionToHorizontalDirection,
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

  it('opens in a useful north-facing local-horizontal view', () => {
    const camera = createInitialPlanetariumCamera();
    const center = getPlanetariumCameraCenter(camera);

    expect(center.altitudeDegrees).toBeCloseTo(35, 8);
    expect(center.azimuthDegrees).toBeCloseTo(0, 8);
    expect(camera.fieldOfViewDegrees).toBe(100);
    expect(camera.mountFrame.kind).toBe('horizontal');
    expect(
      projectHorizontalDirection(
        { altitudeDegrees: 90, azimuthDegrees: 0 },
        camera,
        canvas,
      ).visible,
    ).toBe(true);
  });

  it('keeps the equator locally horizontal in the equatorial mount', () => {
    const observerLatitudeDegrees = 42.7;
    const mountFrame = createEquatorialMountFrame(observerLatitudeDegrees);
    const center = mountDirectionToHorizontalDirection(mountFrame, {
      latitudeDegrees: 0,
      longitudeDegrees: 35,
    });
    const camera = createEquatorialPlanetariumCamera({
      centerAltitudeDegrees: center.altitudeDegrees,
      centerAzimuthDegrees: center.azimuthDegrees,
      fieldOfViewDegrees: 120,
      observerLatitudeDegrees,
    });
    const left = projectHorizontalDirection(
      mountDirectionToHorizontalDirection(mountFrame, {
        latitudeDegrees: 0,
        longitudeDegrees: 25,
      }),
      camera,
      canvas,
    );
    const right = projectHorizontalDirection(
      mountDirectionToHorizontalDirection(mountFrame, {
        latitudeDegrees: 0,
        longitudeDegrees: 45,
      }),
      camera,
      canvas,
    );

    expect(left.yPixels).toBeCloseTo(canvas.heightPixels / 2, 8);
    expect(right.yPixels).toBeCloseTo(canvas.heightPixels / 2, 8);
    expect(left.xPixels).toBeLessThan(right.xPixels);
  });

  it('projects fixed-declination paths as circles around the celestial pole', () => {
    const observerLatitudeDegrees = 42.7;
    const mountFrame = createEquatorialMountFrame(observerLatitudeDegrees);
    const northCelestialPole = mountDirectionToHorizontalDirection(mountFrame, {
      latitudeDegrees: 90,
      longitudeDegrees: 0,
    });
    const camera = createEquatorialPlanetariumCamera({
      centerAltitudeDegrees: northCelestialPole.altitudeDegrees,
      centerAzimuthDegrees: northCelestialPole.azimuthDegrees,
      fieldOfViewDegrees: 120,
      observerLatitudeDegrees,
    });
    const radii = Array.from({ length: 24 }, (_, index) => {
      const point = projectHorizontalDirection(
        mountDirectionToHorizontalDirection(mountFrame, {
          latitudeDegrees: 68,
          longitudeDegrees: index * 15,
        }),
        camera,
        canvas,
      );
      return Math.hypot(
        point.xPixels - canvas.widthPixels / 2,
        point.yPixels - canvas.heightPixels / 2,
      );
    });

    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-7);
  });

  it('round-trips horizontal overlays through an equatorial camera', () => {
    const camera = createEquatorialPlanetariumCamera({
      centerAltitudeDegrees: 55,
      centerAzimuthDegrees: 350,
      fieldOfViewDegrees: 180,
      observerLatitudeDegrees: 42.7,
    });
    for (const direction of [
      { altitudeDegrees: 0, azimuthDegrees: 359.5 },
      { altitudeDegrees: 35, azimuthDegrees: 12 },
      { altitudeDegrees: 89.5, azimuthDegrees: 180 },
    ]) {
      const point = projectHorizontalDirection(direction, camera, canvas);
      const restored = unprojectCanvasPoint(point, camera, canvas);
      expect(restored).not.toBeNull();
      expect(angularSeparationDegrees(direction, restored!)).toBeLessThan(1e-7);
    }
  });

  it('pans incrementally in the equatorial mount without tilting its frame', () => {
    const observerLatitudeDegrees = 42.7;
    const camera = createEquatorialPlanetariumCamera({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 100,
      observerLatitudeDegrees,
    });
    const next = applyPlanetariumPan(
      camera,
      canvas,
      { xPixels: 170, yPixels: 430 },
      { xPixels: 190, yPixels: 415 },
    );
    const mountFrame = createEquatorialMountFrame(observerLatitudeDegrees);
    const poleDotRight =
      next.right.x * mountFrame.pole.x +
      next.right.y * mountFrame.pole.y +
      next.right.z * mountFrame.pole.z;

    expect(next.mountFrame.kind).toBe('equatorial');
    expect(next.mountFrame.pole).toEqual(mountFrame.pole);
    expect(poleDotRight).toBeCloseTo(0, 10);
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

  it('applies a Stellarium-style spherical drag without camera roll', () => {
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

  it('can pan away from the zenith without a coordinate-pole lock', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 90,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 100,
    });
    const next = applyPlanetariumPan(
      camera,
      canvas,
      { xPixels: 200, yPixels: 400 },
      { xPixels: 200, yPixels: 520 },
    );

    expect(getPlanetariumCameraCenter(next).altitudeDegrees).toBeLessThan(85);
    expect(next.fieldOfViewDegrees).toBe(100);
    expect(next.right.y).toBeCloseTo(0, 10);
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
