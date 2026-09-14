import { render } from '@testing-library/react-native';
import { createCelestialTimeTransform } from '../astronomy/celestialTimeTransform';
import { CubeBackgroundLayer } from './CubeBackgroundLayer';
import { createCelestialCubeOrientation } from './backgroundCube';
import { createPlanetariumCamera } from './planetariumProjection';
import { useCubeImage } from './useCubeImage';
import type { SharedValue } from 'react-native-reanimated';

const mockImage = { width: () => 2048, height: () => 1024 };
let mockReadUniforms: () => Record<string, unknown>;
let mockShaderRenders = 0;
jest.mock('@shopify/react-native-skia', () => ({
  AlphaType: { Opaque: 1 },
  ColorType: { RGBA_8888: 1 },
  Fill: ({ children }: { children: React.ReactNode }) => children,
  Group: ({ children }: { children: React.ReactNode }) => children,
  ImageShader: () => null,
  Shader: ({ uniforms }: { uniforms: { value: Record<string, unknown> } }) => {
    mockShaderRenders++;
    mockReadUniforms = () => uniforms.value;
    return null;
  },
  useImage: (source: unknown) => (source ? mockImage : null),
  Skia: {
    RuntimeEffect: { Make: () => ({}) },
    Color: () => [0, 0, 0, 1],
    Data: { fromBytes: () => ({ dispose: jest.fn() }) },
    Image: { MakeImage: () => mockImage },
  },
}));
jest.mock('react-native-reanimated', () => ({
  useDerivedValue: (calculate: () => unknown) => ({
    get value() {
      return calculate();
    },
  }),
}));
jest.mock('./useCubeImage', () => ({
  useCubeImage: jest.fn((source: unknown) => ({
    image: source,
    facePixels: source ? 512 : 0,
  })),
}));

const observer = {
  latitudeDegreesNorth: 40,
  longitudeDegreesEast: 0,
  elevationMetersAboveMeanSeaLevel: 0,
};
const timeTransform = createCelestialTimeTransform({
  observer,
  window: {
    startTimestampUtc: '2026-09-14T12:00:00.000Z',
    endTimestampUtc: '2026-09-15T13:00:00.000Z',
  },
});
const camera = {
  value: createPlanetariumCamera({
    centerAltitudeDegrees: 70,
    centerAzimuthDegrees: 359,
    fieldOfViewDegrees: 100,
  }),
} as SharedValue<ReturnType<typeof createPlanetariumCamera>>;
const canvas = { widthPixels: 1080, heightPixels: 2200 };

it('updates the Milky Way from shared preview time without rerendering or preparing another cube', async () => {
  const sceneTimeMilliseconds = {
    value: Date.parse('2026-09-14T18:00:00.000Z'),
  } as SharedValue<number>;
  const props = {
    camera,
    canvas,
    source: 1,
    timeTransform,
    sceneTimeMilliseconds,
  };
  const view = await render(<CubeBackgroundLayer {...props} />);
  const initial = mockReadUniforms();
  expect(initial.celestial).toBe(1);
  const renderCount = mockShaderRenders;
  const prepareCount = jest.mocked(useCubeImage).mock.calls.length;
  for (const timestampUtc of [
    '2026-09-14T22:00:00.000Z',
    '2026-09-15T13:00:00.000Z',
  ]) {
    sceneTimeMilliseconds.value = Date.parse(timestampUtc);
    const uniforms = mockReadUniforms();
    const expected = createCelestialCubeOrientation({ observer, timestampUtc });
    for (const axis of ['eastJ2000', 'upJ2000', 'northJ2000'] as const) {
      const actual = uniforms[axis] as number[];
      expected[axis].forEach((value, index) => {
        expect(actual[index]).toBeCloseTo(value, 6);
      });
    }
    expect(uniforms.eastJ2000).not.toEqual(initial.eastJ2000);
  }
  expect(mockShaderRenders).toBe(renderCount);
  expect(jest.mocked(useCubeImage)).toHaveBeenCalledTimes(prepareCount);
  await view.unmount();
});

it('keeps local panorama and mask uniforms independent of celestial time', async () => {
  const sceneTimeMilliseconds = {
    value: timeTransform.startTimestampMilliseconds,
  } as SharedValue<number>;
  const props = {
    camera,
    canvas,
    source: 1,
    maskUri: 'synthetic-mask',
    sceneTimeMilliseconds,
  };
  const view = await render(<CubeBackgroundLayer {...props} />);
  const initial = mockReadUniforms();
  expect(initial.celestial).toBe(0);
  expect(initial.maskMode).toBe(2);
  sceneTimeMilliseconds.value = timeTransform.endTimestampMilliseconds;
  expect(mockReadUniforms()).toEqual(initial);
  await view.unmount();
});
