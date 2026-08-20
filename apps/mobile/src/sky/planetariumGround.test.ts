import {
  CARDINAL_LABELS,
  CARDINAL_LABEL_FONT_SIZE_PIXELS,
  createHorizonDirections,
  shouldInvertGroundClip,
} from './planetariumGround';

describe('planetarium ground and cardinals', () => {
  it('defines a closed dense horizon and chooses the correct clip side', () => {
    const horizon = createHorizonDirections(5);

    expect(horizon).toHaveLength(73);
    expect(horizon[0]).toEqual({ altitudeDegrees: 0, azimuthDegrees: 0 });
    expect(horizon.at(-1)).toEqual({
      altitudeDegrees: 0,
      azimuthDegrees: 360,
    });
    expect(shouldInvertGroundClip(45)).toBe(true);
    expect(shouldInvertGroundClip(-1)).toBe(false);
  });

  it('defines all four fixed-size cardinal labels on the horizon', () => {
    expect(CARDINAL_LABELS).toEqual([
      { direction: { altitudeDegrees: 2, azimuthDegrees: 0 }, label: 'N' },
      { direction: { altitudeDegrees: 2, azimuthDegrees: 90 }, label: 'E' },
      { direction: { altitudeDegrees: 2, azimuthDegrees: 180 }, label: 'S' },
      { direction: { altitudeDegrees: 2, azimuthDegrees: 270 }, label: 'W' },
    ]);
    expect(CARDINAL_LABEL_FONT_SIZE_PIXELS).toBeGreaterThanOrEqual(18);
  });
});
