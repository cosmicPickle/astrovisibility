import {
  applySkyNavigationGesture,
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
  it('combines live pan and focal zoom from one stable gesture baseline', () => {
    const viewport = createSkyViewport({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      horizontalSpanDegrees: 40,
    });
    const focalDirection = {
      altitudeDegrees: 62.7777777778,
      azimuthDegrees: 190,
    };
    const transformed = applySkyNavigationGesture(viewport, canvas, {
      focalXPixels: 270,
      focalYPixels: 160,
      scale: 2,
      translationXPixels: 24,
      translationYPixels: 18,
    });

    const projected = projectDirectionToViewport(
      focalDirection,
      transformed,
      canvas,
    );
    expect(projected?.xPixels).toBeCloseTo(294);
    expect(projected?.yPixels).toBeCloseTo(178);
    expect(transformed.horizontalSpanDegrees).toBe(20);
  });

  it('is stable when the final gesture sample is applied again on release', () => {
    const viewport = createSkyViewport({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      horizontalSpanDegrees: 120,
    });
    const gesture = {
      focalXPixels: 180,
      focalYPixels: 320,
      scale: 1.4,
      translationXPixels: -42,
      translationYPixels: 16,
    };
    const duringGesture = applySkyNavigationGesture(viewport, canvas, gesture);
    const atRelease = applySkyNavigationGesture(viewport, canvas, gesture);

    expect(atRelease).toEqual(duringGesture);
  });

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
