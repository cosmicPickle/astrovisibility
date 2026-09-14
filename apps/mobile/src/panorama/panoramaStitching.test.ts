import { requireOptionalNativeModule } from 'expo';
import { File } from 'expo-file-system';

import { bootstrapStorage } from '../storage/bootstrapStorage';
import { panoramaStitchingController as controller } from './panoramaStitching';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock('../storage/bootstrapStorage', () => ({
  bootstrapStorage: jest.fn(),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

const files = new Map<
  string,
  {
    uri: string;
    parentDirectory: string;
    exists: boolean;
    bytes: jest.Mock;
    copy: jest.Mock;
    delete: jest.Mock;
  }
>();
const native = {
  stitch: jest.fn(),
  cancel: jest.fn(),
  discard: jest.fn(),
  addListener: jest.fn(),
};
const remove = jest.fn();
const complete = jest.fn();
const getForProfile = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  files.clear();
  jest.mocked(File).mockImplementation(((parent: string, child?: string) => {
    const uri = child ? `${parent}/${child}` : parent;
    if (!files.has(uri))
      files.set(uri, {
        uri,
        parentDirectory: 'file:///cache/job',
        exists: true,
        bytes: jest.fn().mockResolvedValue(new Uint8Array((2048 * 2048) / 8)),
        copy: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn(),
      });
    return files.get(uri);
  }) as unknown as (...args: ConstructorParameters<typeof File>) => File);
  jest.mocked(requireOptionalNativeModule).mockReturnValue(native);
  jest
    .mocked(bootstrapStorage)
    .mockResolvedValue({ panoramas: { complete, getForProfile } } as never);
  getForProfile.mockResolvedValue({
    id: 'draft',
    tiles: [
      {
        uri: 'file:///photo.jpg',
        reviewedPlacement: {
          centerAltitudeDegrees: 80,
          centerAzimuthDegrees: 359,
          rollDegrees: 12,
          horizontalFieldOfViewDegrees: 60,
          verticalFieldOfViewDegrees: 45,
        },
      },
    ],
  });
  native.addListener.mockReturnValue({ remove });
  native.stitch.mockResolvedValue({
    uri: 'file:///cache/job/panorama.png',
    coverageUri: 'file:///cache/job/panorama.coverage',
    unmatchedCount: 0,
  });
  native.discard.mockResolvedValue(undefined);
  complete.mockResolvedValue(undefined);
});

it('passes only local photo and placement data, then creates one directional preview', async () => {
  const preview = await controller.create(
    'profile',
    new AbortController().signal,
    jest.fn(),
  );
  const input = JSON.parse(native.stitch.mock.calls[0][1]);
  expect(Object.keys(input[0]).sort()).toEqual(['reviewedPlacement', 'uri']);
  expect(preview.panorama).toMatchObject({
    profileId: 'profile',
    tiles: [],
    widthPixels: 2048,
    uri: 'file:///cache/job/panorama.png',
    projection: 'azimuthal-equidistant-upper-hemisphere',
  });
  expect(preview.centerAltitudeDegrees).toBe(80);
  expect(complete).not.toHaveBeenCalled();
  expect(remove).toHaveBeenCalledTimes(1);
});

it('cancels native work and disposes a result that arrives after cancellation', async () => {
  const abort = new AbortController();
  native.stitch.mockImplementation(async () => {
    abort.abort();
    return { uri: 'file:///late.png' };
  });
  await expect(
    controller.create('profile', abort.signal, jest.fn()),
  ).rejects.toThrow('Cancelled');
  expect(native.cancel).toHaveBeenCalledWith(native.stitch.mock.calls[0][0]);
  expect(native.discard).toHaveBeenCalledWith(native.stitch.mock.calls[0][0]);
  expect(remove).toHaveBeenCalled();
});

it('rejects invalid coverage and preserves the draft', async () => {
  new File('file:///cache/job/panorama.coverage');
  files
    .get('file:///cache/job/panorama.coverage')!
    .bytes.mockResolvedValue(new Uint8Array(1));
  await expect(
    controller.create('profile', new AbortController().signal, jest.fn()),
  ).rejects.toThrow('Invalid panorama coverage');
  expect(native.discard).toHaveBeenCalled();
  expect(complete).not.toHaveBeenCalled();
});

it('copies the preview before promotion, so failed transactions can be retried', async () => {
  const preview = await controller.create(
    'profile',
    new AbortController().signal,
    jest.fn(),
  );
  complete.mockRejectedValueOnce(new Error('transaction'));
  await expect(controller.save(preview)).rejects.toThrow('transaction');
  expect(complete.mock.calls[0][3].temporaryUri).not.toBe(
    preview.asset.temporaryUri,
  );
  expect(files.get(preview.asset.temporaryUri)!.delete).not.toHaveBeenCalled();
  await controller.save(preview);
  expect(complete).toHaveBeenCalledTimes(2);
  expect(files.get(preview.asset.temporaryUri)!.copy).toHaveBeenCalledTimes(2);
});

it('does not start native work for an empty or aborted draft', async () => {
  getForProfile.mockResolvedValueOnce(null);
  await expect(
    controller.create('profile', new AbortController().signal, jest.fn()),
  ).rejects.toThrow('Capture at least one');
  const abort = new AbortController();
  abort.abort();
  await expect(
    controller.create('profile', abort.signal, jest.fn()),
  ).rejects.toThrow('Cancelled');
  expect(native.stitch).not.toHaveBeenCalled();
});
