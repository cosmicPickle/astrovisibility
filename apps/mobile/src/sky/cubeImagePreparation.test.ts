import { Skia, type SkImage } from '@shopify/react-native-skia';
import { prepareCubeImage } from './cubeImagePreparation';

jest.mock('@shopify/react-native-skia', () => ({
  FilterMode: { Linear: 1 },
  MipmapMode: { None: 0 },
  TileMode: { Repeat: 1, Decal: 3, Clamp: 0 },
  Skia: {
    RuntimeEffect: { Make: jest.fn() },
    Surface: { MakeOffscreen: jest.fn() },
    Paint: jest.fn(),
    Color: jest.fn(),
    XYWHRect: jest.fn(),
  },
}));

it('transfers a raster copy across drawing contexts and releases every temporary GPU resource', async () => {
  const raster = { dispose: jest.fn() };
  const snapshot = {
    makeNonTextureImage: jest.fn(() => raster),
    dispose: jest.fn(),
  };
  const surface = {
    getCanvas: () => ({ clear: jest.fn(), drawRect: jest.fn() }),
    flush: jest.fn(),
    makeImageSnapshot: jest.fn(() => snapshot),
    dispose: jest.fn(),
  };
  const child = { dispose: jest.fn() },
    shader = { dispose: jest.fn() },
    paint = { setShader: jest.fn(), dispose: jest.fn() };
  jest.mocked(Skia.Surface.MakeOffscreen).mockReturnValue(surface as never);
  jest
    .mocked(Skia.RuntimeEffect.Make)
    .mockReturnValue({ makeShaderWithChildren: () => shader } as never);
  jest.mocked(Skia.Paint).mockReturnValue(paint as never);
  const source = {
    width: () => 2048,
    height: () => 2048,
    makeShaderOptions: () => child,
    dispose: jest.fn(),
  } as unknown as SkImage;
  const result = await prepareCubeImage(source, false, 1024, () => false);
  expect(result).toBe(raster);
  expect(snapshot.makeNonTextureImage).toHaveBeenCalledTimes(1);
  for (const resource of [snapshot, surface, child, shader, paint])
    expect(resource.dispose).toHaveBeenCalledTimes(1);
  expect(source.dispose).not.toHaveBeenCalled();
  expect(raster.dispose).not.toHaveBeenCalled();
});
