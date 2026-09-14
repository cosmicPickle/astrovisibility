import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { SkImage } from '@shopify/react-native-skia';
import { useCubeImage } from './useCubeImage';
import { prepareCubeImage } from './cubeImagePreparation';

jest.mock('./cubeImagePreparation', () => ({ prepareCubeImage: jest.fn() }));
const prepare = jest.mocked(prepareCubeImage);
const image = () => ({ dispose: jest.fn() }) as unknown as SkImage;

beforeEach(() => prepare.mockReset());

it('keeps the source during preparation, reuses the cube on rerender, and disposes only owned images', async () => {
  const source = image(),
    cube = image();
  let complete!: (value: SkImage) => void;
  prepare.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const hook = await renderHook(() => useCubeImage(source, false, 1024));
  expect(hook.result.current).toEqual({ image: source, facePixels: 0 });
  await act(() => complete(cube));
  expect(hook.result.current).toEqual({ image: cube, facePixels: 1024 });
  await hook.rerender(undefined);
  expect(prepare).toHaveBeenCalledTimes(1);
  await hook.unmount();
  expect(cube.dispose).toHaveBeenCalledTimes(1);
  expect(source.dispose).not.toHaveBeenCalled();
});

it('cancels obsolete mask preparations and never displays a cube from a previous source', async () => {
  const first = image(),
    second = image(),
    obsolete = image(),
    current = image();
  const completions: Array<(value: SkImage) => void> = [];
  prepare.mockImplementation(
    () =>
      new Promise((resolve) => {
        completions.push(resolve);
      }),
  );
  const hook = await renderHook(
    ({ source }: { source: SkImage }) => useCubeImage(source, false, 1024),
    { initialProps: { source: first } },
  );
  await hook.rerender({ source: second });
  expect(prepare.mock.calls[0]![3]()).toBe(true);
  await act(() => completions[0]!(obsolete));
  expect(obsolete.dispose).toHaveBeenCalledTimes(1);
  expect(hook.result.current.image).toBe(second);
  await act(() => completions[1]!(current));
  expect(hook.result.current.image).toBe(current);
  await hook.unmount();
  expect(current.dispose).toHaveBeenCalledTimes(1);
});

it('keeps functional exact-source rendering after a failed bake', async () => {
  const source = image();
  prepare.mockRejectedValue(new Error('allocation failed'));
  const hook = await renderHook(() => useCubeImage(source, false, 1024));
  await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
  expect(hook.result.current).toEqual({ image: source, facePixels: 0 });
  await hook.unmount();
  expect(source.dispose).not.toHaveBeenCalled();
});
