import {
  CARDINAL_LABELS,
  CARDINAL_LABEL_FONT_SIZE_PIXELS,
  CELESTIAL_EQUATOR_STROKE_OPACITY,
  createProjectedGroundClip,
  createHorizonDirections,
} from './planetariumGround';
import { createPlanetariumCamera } from './planetariumProjection';

const canvas = { widthPixels: 400, heightPixels: 800 };

describe('planetarium ground and cardinals', () => {
  it('defines a closed dense horizon', () => {
    const horizon = createHorizonDirections(5);

    expect(horizon).toHaveLength(73);
    expect(horizon[0]).toEqual({ altitudeDegrees: 0, azimuthDegrees: 0 });
    expect(horizon.at(-1)).toEqual({
      altitudeDegrees: 0,
      azimuthDegrees: 360,
    });
  });

  it.each([
    { altitudeDegrees: 45, expectedKind: 'circle', groundOutside: true },
    { altitudeDegrees: 0, expectedKind: 'polygon', groundOutside: false },
    { altitudeDegrees: -45, expectedKind: 'circle', groundOutside: false },
  ])(
    'creates a stable analytic ground clip at $altitudeDegrees degrees',
    ({ altitudeDegrees, expectedKind, groundOutside }) => {
      const camera = createPlanetariumCamera({
        centerAltitudeDegrees: altitudeDegrees,
        centerAzimuthDegrees: 0,
        fieldOfViewDegrees: 100,
      });
      const clip = createProjectedGroundClip(camera, canvas);

      expect(clip.kind).toBe(expectedKind);
      expect(clip.groundOutside).toBe(groundOutside);
      expect(clip).not.toHaveProperty('sampledHorizon');
      if (clip.kind === 'circle') {
        expect(Number.isFinite(clip.centerXPixels)).toBe(true);
        expect(Number.isFinite(clip.centerYPixels)).toBe(true);
        expect(clip.radiusPixels).toBeGreaterThan(0);
      } else {
        expect(clip.points.length).toBeGreaterThanOrEqual(3);
        expect(
          clip.points.every(
            ({ xPixels, yPixels }) =>
              Number.isFinite(xPixels) && Number.isFinite(yPixels),
          ),
        ).toBe(true);
      }
    },
  );

  it('puts ground below the straight north-facing horizon', () => {
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 0,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 100,
    });
    const clip = createProjectedGroundClip(camera, canvas);

    expect(clip).toEqual({
      groundOutside: false,
      kind: 'polygon',
      points: [
        { xPixels: 400, yPixels: 400 },
        { xPixels: 400, yPixels: 800 },
        { xPixels: 0, yPixels: 800 },
        { xPixels: 0, yPixels: 400 },
      ],
    });
  });

  it('defines all four fixed-size cardinal labels on the horizon', () => {
    expect(CARDINAL_LABELS).toEqual([
      { direction: { altitudeDegrees: 2, azimuthDegrees: 0 }, label: 'N' },
      { direction: { altitudeDegrees: 2, azimuthDegrees: 90 }, label: 'E' },
      { direction: { altitudeDegrees: 2, azimuthDegrees: 180 }, label: 'S' },
      { direction: { altitudeDegrees: 2, azimuthDegrees: 270 }, label: 'W' },
    ]);
    expect(CARDINAL_LABEL_FONT_SIZE_PIXELS).toBeGreaterThanOrEqual(18);
    expect(CELESTIAL_EQUATOR_STROKE_OPACITY).toBeLessThanOrEqual(0.2);
  });
});
