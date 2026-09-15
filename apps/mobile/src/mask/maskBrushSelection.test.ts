import {
  applyMaskSelection,
  createMaskBrushRequest,
} from './maskBrushSelection';
import {
  createPlanetariumCamera,
  createPlanetariumProjectionContext,
} from '../sky/planetariumProjection';

jest.mock('expo', () => ({
  requireOptionalNativeModule: () => null,
}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

describe('directional mask selections', () => {
  it('rejects oversized strokes before native work', () => {
    expect(() =>
      createMaskBrushRequest({
        points: Array(4097).fill({ xPixels: 1, yPixels: 1 }),
        brushDiameterPixels: 32,
        mode: 'manual',
        canvas: { widthPixels: 320, heightPixels: 580 },
        camera: createPlanetariumCamera({
          centerAltitudeDegrees: 45,
          centerAzimuthDegrees: 0,
          fieldOfViewDegrees: 80,
        }),
      }),
    ).toThrow(/shorter stroke/i);
  });
  it('applies mixed manual/magic selections chronologically without exposing uncaptured directions', () => {
    const coverage = new Uint8Array([0b00111111]);
    const initial = new Uint8Array([0b11000001]);
    const drawn = applyMaskSelection(
      initial,
      coverage,
      new Uint8Array([0b00001110]),
      true,
    );
    expect(drawn[0]).toBe(0b11001111);
    const erased = applyMaskSelection(
      drawn,
      coverage,
      new Uint8Array([0b11100110]),
      false,
    );
    expect(erased[0]).toBe(0b11001001);
    expect(initial[0]).toBe(0b11000001);
    expect(() =>
      applyMaskSelection(initial, coverage, new Uint8Array(2), false),
    ).toThrow();
  });

  it.each([0, 359.9])(
    'uses the current camera basis for upward strokes across north %s',
    (azimuth) => {
      const camera = createPlanetariumCamera({
        centerAltitudeDegrees: 89.9,
        centerAzimuthDegrees: azimuth,
        fieldOfViewDegrees: 35,
      });
      const canvas = { widthPixels: 320, heightPixels: 580 };
      const request = createMaskBrushRequest({
        camera,
        canvas,
        points: [{ xPixels: 100, yPixels: 120 }],
        brushDiameterPixels: 32,
        mode: 'magic',
      });
      expect(request.view).toEqual([
        320,
        580,
        createPlanetariumProjectionContext(camera, canvas)
          .projectionScalePixels,
        camera.right.x,
        camera.right.y,
        camera.right.z,
        camera.up.x,
        camera.up.y,
        camera.up.z,
        camera.forward.x,
        camera.forward.y,
        camera.forward.z,
      ]);
      expect(request.points).toEqual([[100, 120]]);
      expect(request.radius).toBe(16);
      expect(request.mode).toBe('magic');
    },
  );
});
