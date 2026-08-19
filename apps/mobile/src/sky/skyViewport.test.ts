import {
  applySkyPan,
  applySkyZoom,
  createTrajectoryInspectionViewport,
  createSkyViewport,
  projectDirectionToViewport,
} from './skyViewport';

describe('trajectory inspection viewport', () => {
  it('fits a north-wrapping above-horizon trajectory with padding', () => {
    const viewport = createTrajectoryInspectionViewport(
      [
        { unwrappedAzimuthDegrees: 350, refractedAltitudeDegrees: 20 },
        { unwrappedAzimuthDegrees: 370, refractedAltitudeDegrees: 50 },
      ],
      { widthPixels: 400, heightPixels: 800 },
    );

    if (!viewport) throw new Error('Expected an inspection viewport.');
    expect(viewport.centerAzimuthDegrees).toBeCloseTo(0);
    expect(viewport.centerAltitudeDegrees).toBeCloseTo(35);
    expect(viewport.horizontalSpanDegrees).toBeGreaterThanOrEqual(24);
  });

  it('returns null when the trajectory never reaches the visible hemisphere', () => {
    expect(
      createTrajectoryInspectionViewport(
        [
          { unwrappedAzimuthDegrees: 100, refractedAltitudeDegrees: -10 },
          { unwrappedAzimuthDegrees: 110, refractedAltitudeDegrees: -2 },
        ],
        { widthPixels: 400, heightPixels: 800 },
      ),
    ).toBeNull();
  });
});

const canvas = { widthPixels: 360, heightPixels: 640 };

describe('sky viewport navigation', () => {
  it('wraps continuously through north and clamps vertical navigation', () => {
    const viewport = createSkyViewport({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 2,
      horizontalSpanDegrees: 90,
    });
    const panned = applySkyPan(viewport, canvas, {
      translationXPixels: 18,
      translationYPixels: 1_000,
    });

    expect(panned.centerAzimuthDegrees).toBeCloseTo(357.5);
    expect(panned.centerAltitudeDegrees).toBeLessThanOrEqual(45);
    expect(
      projectDirectionToViewport(
        { altitudeDegrees: 45, azimuthDegrees: 359 },
        viewport,
        canvas,
      )?.xPixels,
    ).toBeCloseTo(168);
  });

  it('keeps the sky beneath the pinch focal point while zooming', () => {
    const viewport = createSkyViewport({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      horizontalSpanDegrees: 180,
    });
    const focalPoint = { xPixels: 270, yPixels: 160 };
    const before = projectDirectionToViewport(
      { altitudeDegrees: 67.5, azimuthDegrees: 225 },
      viewport,
      canvas,
    );
    const zoomed = applySkyZoom(viewport, canvas, {
      focalXPixels: focalPoint.xPixels,
      focalYPixels: focalPoint.yPixels,
      scale: 2,
    });
    const after = projectDirectionToViewport(
      { altitudeDegrees: 67.5, azimuthDegrees: 225 },
      zoomed,
      canvas,
    );

    expect(before).toEqual(focalPoint);
    expect(after?.xPixels).toBeCloseTo(focalPoint.xPixels);
    expect(after?.yPixels).toBeCloseTo(focalPoint.yPixels);
    expect(zoomed.horizontalSpanDegrees).toBe(90);
  });

  it('keeps the zenith reachable at narrow zoom', () => {
    const viewport = createSkyViewport({
      centerAltitudeDegrees: 89,
      centerAzimuthDegrees: 0,
      horizontalSpanDegrees: 30,
    });
    expect(
      projectDirectionToViewport(
        { altitudeDegrees: 90, azimuthDegrees: 0 },
        viewport,
        canvas,
      ),
    ).not.toBeNull();
  });
});
