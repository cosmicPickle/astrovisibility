import { colors, layout } from './tokens';

describe('Astrovisibility theme tokens', () => {
  it('uses the approved space palette and accessible interaction sizing', () => {
    expect(colors.background).toBe('#080B12');
    expect(colors.primary).toBe('#5B9CFF');
    expect(colors.spaceViolet).toBe('#8A7DFF');
    expect(layout.minimumTouchTarget).toBeGreaterThanOrEqual(44);
  });
});
