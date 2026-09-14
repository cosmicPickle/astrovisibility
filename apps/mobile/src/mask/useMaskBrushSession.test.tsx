import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  createMaskSelectionSession,
  type MaskBrushStroke,
} from './maskBrushSelection';
import { useMaskBrushSession } from './useMaskBrushSession';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';

jest.mock('./maskBrushSelection', () => ({
  createMaskSelectionSession: jest.fn(),
}));

const panorama = {
  id: 'panorama',
  profileId: 'profile',
  tiles: [],
} as ActivePanorama;
const stroke = {} as MaskBrushStroke;

describe('mask brush session lifecycle', () => {
  it('applies the captured draw/erase mode and recovers from a failed selection', async () => {
    const session = {
      select: jest.fn().mockResolvedValue(new Uint8Array([6])),
      close: jest.fn(),
    };
    jest.mocked(createMaskSelectionSession).mockReturnValue(session);
    const commit = jest.fn(),
      processing = jest.fn();
    const hook = await renderHook(() =>
      useMaskBrushSession(panorama, commit, processing),
    );
    await waitFor(() => expect(createMaskSelectionSession).toHaveBeenCalled());
    await act(() => hook.result.current.apply(stroke, false));
    expect(commit).toHaveBeenCalledWith(new Uint8Array([6]), false);
    expect(processing).toHaveBeenLastCalledWith(false);
    session.select.mockRejectedValueOnce(new Error('synthetic failure'));
    await act(() => hook.result.current.apply(stroke, true));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(hook.result.current.error).toMatch(/manual painting/);
    await act(() => hook.result.current.apply(stroke, true));
    expect(hook.result.current.error).toBeNull();
    expect(commit).toHaveBeenLastCalledWith(new Uint8Array([6]), true);
    await hook.unmount();
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it('closes processing on exit and ignores a late native result', async () => {
    let finish!: (value: Uint8Array<ArrayBuffer>) => void;
    const session = {
      select: jest.fn(
        () =>
          new Promise<Uint8Array<ArrayBuffer>>((resolve) => {
            finish = resolve;
          }),
      ),
      close: jest.fn(),
    };
    jest.mocked(createMaskSelectionSession).mockReturnValue(session);
    const commit = jest.fn(),
      processing = jest.fn();
    const hook = await renderHook(() =>
      useMaskBrushSession(panorama, commit, processing),
    );
    let pending!: Promise<void>;
    await act(async () => {
      pending = hook.result.current.apply(stroke, true);
    });
    await hook.unmount();
    await act(async () => {
      finish(new Uint8Array([7]));
      await pending;
    });
    expect(session.close).toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});
