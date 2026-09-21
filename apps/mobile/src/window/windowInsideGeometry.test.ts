import { createImagingFrame } from '../astronomy/imagingFrame';
import { vectorToHorizontalDirection } from '../sky/planetariumProjection';
import { physicalWindow, rotateAboutAxis } from './__fixtures__/physicalWindow';
import { windowContainsFrame } from './windowFrame';
import {
  createWindowGeometry,
  lensPositionMeters,
  moveWindowCorner,
  windowContainsRay,
} from './windowGeometry';

it('reconstructs independently measured rectangles at different widths, spans, yaw and off-centre positions', () => {
  for (const width of [1.2, 1.6])
    for (const span of [30, 90, 160, 178, 179.99])
      for (const across of [0.05, 0.25, 0.5, 0.75, 0.95])
        for (const yaw of [0, 180, 359]) {
          const fixture = physicalWindow(width, span, across, yaw);
          const geometry = createWindowGeometry(fixture.definition);
          expect(geometry.distanceMeters).toBeCloseTo(fixture.depth, 10);
          expect(geometry.heightMeters).toBeCloseTo(1.35, 10);
          for (let index = 0; index < 4; index++) {
            const expected = fixture.corners[index]!;
            const actual = geometry.corners[index]!;
            expect(
              Math.hypot(
                actual.x - expected.x,
                actual.y - expected.y,
                actual.z - expected.z,
              ),
            ).toBeLessThan(1e-9);
            const unchanged = moveWindowCorner(
              fixture.definition,
              index,
              vectorToHorizontalDirection(expected),
            );
            expect(unchanged.rightDistanceRatio).toBeCloseTo(
              fixture.definition.rightDistanceRatio,
              10,
            );
          }
        }
});

it('shows that a 178-degree capture does not exclude a moving 50 mm lens crossing the plane', () => {
  for (const width of [1.2, 1.6]) {
    const fixture = physicalWindow(width, 178);
    expect(fixture.depth).toBeCloseTo(
      (width / 2) * Math.tan(Math.PI / 180),
      10,
    );
    for (const across of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      const offCentre = physicalWindow(width, 178, across);
      expect(offCentre.depth).toBeLessThanOrEqual(fixture.depth + 1e-12);
    }
    const leftwardLens = lensPositionMeters(
      { azimuthDegrees: 280, altitudeDegrees: 20 },
      50,
      'altaz',
      44,
    );
    const rightwardLens = lensPositionMeters(
      { azimuthDegrees: 80, altitudeDegrees: 20 },
      50,
      'altaz',
      44,
    );
    expect(fixture.depth - leftwardLens.z).toBeLessThan(0);
    expect(fixture.depth - rightwardLens.z).toBeGreaterThan(0);
  }
});

it.each(['altaz', 'equatorial', 'derotatedAltaz'] as const)(
  'matches independent rigid rotations for signed lens offset in %s mode',
  (mode) => {
    for (const latitude of [-70, 0, 44, 70])
      for (const angle of [-175, -90, -10, 0, 30, 100, 175])
        for (const declination of [-60, 0, 60]) {
          const tilt =
            ((mode === 'equatorial' ? latitude : 90) * Math.PI) / 180;
          const axis = { x: 0, y: Math.sin(tilt), z: Math.cos(tilt) };
          const dec = (declination * Math.PI) / 180;
          const meridian = {
            x: 0,
            y: -Math.cos(tilt) * Math.cos(dec) + axis.y * Math.sin(dec),
            z: Math.sin(tilt) * Math.cos(dec) + axis.z * Math.sin(dec),
          };
          const forward = rotateAboutAxis(
            meridian,
            axis,
            (angle * Math.PI) / 180,
          );
          for (const offset of [-50, 0, 50]) {
            const expected = rotateAboutAxis(
              { x: offset / 1000, y: 0, z: 0 },
              axis,
              (angle * Math.PI) / 180,
            );
            const actual = lensPositionMeters(
              vectorToHorizontalDirection(forward),
              offset,
              mode,
              latitude,
            );
            expect(
              Math.hypot(
                actual.x - expected.x,
                actual.y - expected.y,
                actual.z - expected.z,
              ),
            ).toBeLessThan(1e-12);
          }
        }
  },
);

it.each(['altaz', 'equatorial', 'derotatedAltaz'] as const)(
  'matches physical ray-plane intersections for behind-plane centres and complete frames in %s mode',
  (mode) => {
    let checked = 0;
    const failures: unknown[] = [];
    for (const width of [1.2, 1.6])
      for (const span of [90, 178, 179.99])
        for (const across of [0.1, 0.5, 0.9])
          for (const yaw of [0, 180, 359]) {
            const fixture = physicalWindow(width, span, across, yaw);
            const geometry = createWindowGeometry(fixture.definition);
            for (const offset of [-50, 0, 50])
              for (let azimuth = -179.3; azimuth < 180; azimuth += 5)
                for (const altitude of [0, 20, 60, 89]) {
                  const direction = {
                    azimuthDegrees: azimuth + yaw,
                    altitudeDegrees: altitude,
                  };
                  const lens = lensPositionMeters(direction, offset, mode, 44);
                  // The separately documented exterior defect is deferred.
                  if (fixture.depth - fixture.toLocal(lens).z <= 1e-6) continue;
                  const frame = createImagingFrame({
                    horizontalFovDegrees: checked % 2 ? 3 : 0.2,
                    verticalFovDegrees: checked % 2 ? 2 : 0.1,
                    orientationDegrees: checked % 3 ? 0 : 37,
                    trackingMode: mode,
                    horizontal: {
                      azimuthDegreesClockwiseFromNorth:
                        direction.azimuthDegrees,
                      refractedAltitudeDegrees: altitude,
                    },
                    observerLatitudeDegrees: 44,
                  });
                  const expectedCentre = fixture.rayClearsOpening(
                    frame.center,
                    lens,
                  );
                  const expectedFrame = frame.corners.every((ray) =>
                    fixture.rayClearsOpening(ray, lens),
                  );
                  if (
                    windowContainsRay(geometry, frame.center, lens) !==
                      expectedCentre ||
                    windowContainsFrame(geometry, frame, lens) !== expectedFrame
                  ) {
                    if (failures.length < 10)
                      failures.push({
                        width,
                        span,
                        across,
                        yaw,
                        offset,
                        direction,
                      });
                  }
                  checked++;
                }
          }
    expect(checked).toBeGreaterThan(25000);
    expect(failures).toEqual([]);
    console.info('behind_plane_geometry_audit', mode, checked);
  },
  30000,
);
