import { createImagingFrame } from '../astronomy/imagingFrame';
import { equatorialJ2000ToHorizontal } from '../astronomy/horizontalCoordinates';
import { horizontalDirectionToVector } from '../sky/planetariumProjection';
import { physicalWindow } from './__fixtures__/physicalWindow';
import { windowContainsFrame } from './windowFrame';
import { createWindowGeometry, lensPositionMeters } from './windowGeometry';

// Documents a missing physical dimension, not the desired final classifier.
// Replace the clear expectation when finite-aperture clearance is implemented.
it('demonstrates aperture shading despite a clear full frame behind a 178-degree window', () => {
  const fixture = physicalWindow(1.2, 178);
  const direction = { azimuthDegrees: 82, altitudeDegrees: 20 };
  const lens = lensPositionMeters(direction, 50, 'altaz', 44);
  const frame = createImagingFrame({
    horizontalFovDegrees: 3,
    verticalFovDegrees: 2,
    orientationDegrees: 0,
    trackingMode: 'altaz',
    observerLatitudeDegrees: 44,
    horizontal: {
      azimuthDegreesClockwiseFromNorth: 82,
      refractedAltitudeDegrees: 20,
    },
  });
  const right = horizontalDirectionToVector({
    azimuthDegrees: 172,
    altitudeDegrees: 0,
  });
  const pupilEdge = {
    x: lens.x + 0.0175 * right.x,
    y: lens.y,
    z: lens.z + 0.0175 * right.z,
  };
  expect(fixture.depth - lens.z).toBeGreaterThan(0.0175);
  expect(
    windowContainsFrame(createWindowGeometry(fixture.definition), frame, lens),
  ).toBe(true);
  expect(
    frame.corners.every((ray) => fixture.rayClearsOpening(ray, lens)),
  ).toBe(true);
  expect(
    frame.corners.every((ray) => fixture.rayClearsOpening(ray, pupilEdge)),
  ).toBe(false);
});

it('measures the missing aperture contribution separately from the 50 mm lateral displacement', () => {
  const start = Date.parse('2026-09-20T21:00:00Z');
  const results: unknown[] = [];
  for (const across of [0.1, 0.5, 0.9]) {
    const fixture = physicalWindow(1.2, 178, across, 180);
    const geometry = createWindowGeometry(fixture.definition);
    let pointEnd: number | undefined;
    let pupilEnd: number | undefined;
    for (let second = 0; second <= 21600; second++) {
      const horizontal = equatorialJ2000ToHorizontal({
        rightAscensionJ2000Hours: 19.99343888888889,
        declinationJ2000Degrees: 22.721027777777778,
        observer: {
          latitudeDegreesNorth: 44,
          longitudeDegreesEast: 0,
          elevationMetersAboveMeanSeaLevel: 0,
        },
        timestampUtc: new Date(start + second * 1000).toISOString(),
      });
      const frame = createImagingFrame({
        horizontalFovDegrees: 3,
        verticalFovDegrees: 2,
        orientationDegrees: 0,
        trackingMode: 'altaz',
        observerLatitudeDegrees: 44,
        horizontal,
      });
      const lens = lensPositionMeters(
        {
          azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
          altitudeDegrees: horizontal.refractedAltitudeDegrees,
        },
        50,
        'altaz',
        44,
      );
      if (pointEnd === undefined && !windowContainsFrame(geometry, frame, lens))
        pointEnd = second;
      const localLens = fixture.toLocal(lens);
      const opticalAxis = fixture.toLocal(frame.center);
      const radius = 0.0175;
      // All pupil points remain behind: this cannot exercise the deferred defect.
      expect(fixture.depth - localLens.z).toBeGreaterThan(
        radius * Math.sqrt(1 - opticalAxis.z ** 2),
      );
      const pupilClear = frame.corners.every((worldRay) => {
        const ray = fixture.toLocal(worldRay);
        if (ray.z <= 0) return false;
        const travel = (fixture.depth - localLens.z) / ray.z;
        const x = localLens.x + travel * ray.x;
        const y = localLens.y + travel * ray.y;
        // Exact extrema of projected circular pupil, not a sampled ring.
        const xExtent =
          radius *
          Math.sqrt(
            Math.max(
              0,
              1 +
                (ray.x / ray.z) ** 2 -
                (opticalAxis.x - (opticalAxis.z * ray.x) / ray.z) ** 2,
            ),
          );
        const yExtent =
          radius *
          Math.sqrt(
            Math.max(
              0,
              1 +
                (ray.y / ray.z) ** 2 -
                (opticalAxis.y - (opticalAxis.z * ray.y) / ray.z) ** 2,
            ),
          );
        return (
          x - xExtent > -1.2 * across &&
          x + xExtent < 1.2 * (1 - across) &&
          y - yExtent > -0.25 &&
          y + yExtent < 1.1
        );
      });
      if (pupilEnd === undefined && !pupilClear) pupilEnd = second;
      if (pointEnd !== undefined && pupilEnd !== undefined) break;
    }
    expect(pointEnd).toBeDefined();
    expect(pupilEnd).toBeDefined();
    expect(pupilEnd!).toBeLessThan(pointEnd!);
    results.push({
      across,
      pointEndSeconds: pointEnd,
      pupilEndSeconds: pupilEnd,
      missingSeconds: pointEnd! - pupilEnd!,
    });
  }
  console.info('finite_aperture_model_gap', results);
});
