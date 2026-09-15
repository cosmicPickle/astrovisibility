import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PanoramaStitchingScreen } from './PanoramaStitchingScreen';
import type {
  StitchingController,
  StitchedPreview,
} from '../panorama/panoramaStitching';

const preview = {
  jobId: 'job',
  draftId: 'draft',
  unmatchedCount: 1,
} as StitchedPreview;

function setup(
  overrides: Partial<StitchingController> = {},
  allowManualAdjustment = true,
) {
  const controller: StitchingController = {
    create: jest.fn().mockResolvedValue(preview),
    save: jest.fn().mockResolvedValue(undefined),
    discard: jest.fn().mockResolvedValue(undefined),
    prepareManual: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const navigation = {
    backToCapture: jest.fn(),
    onAccepted: jest.fn(),
    manual: jest.fn(),
  };
  return {
    controller,
    navigation,
    view: render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 360, height: 640 },
          insets: { top: 24, bottom: 24, left: 0, right: 0 },
        }}
      >
        <PanoramaStitchingScreen
          allowManualAdjustment={allowManualAdjustment}
          controller={controller}
          navigation={navigation}
          profileId="profile"
          renderPreview={() => <Text>single panorama</Text>}
        />
      </SafeAreaProvider>,
    ),
  };
}

it('automatically stitches, discloses unmatched photos, and saves only on acceptance', async () => {
  const { controller, navigation, view: pending } = setup();
  const view = await pending;
  await view.findByText('single panorama');
  expect(controller.create).toHaveBeenCalledTimes(1);
  expect(controller.save).not.toHaveBeenCalled();
  expect(view.getByText(/1 photo could not be matched/)).toBeTruthy();
  await fireEvent.press(view.getByText('Use panorama'));
  await waitFor(() => expect(navigation.onAccepted).toHaveBeenCalledTimes(1));
  expect(controller.save).toHaveBeenCalledWith(preview);
});

it('continuous review retains acceptance and retry without offering tile adjustments', async () => {
  const { view: pending } = setup({}, false);
  const view = await pending;
  await view.findByText('single panorama');
  expect(view.queryByText('Adjust manually')).toBeNull();
  expect(view.getByText('Use panorama')).toBeTruthy();
  expect(view.getByText('Back to camera')).toBeTruthy();
});

it('preserves recovered placements before entering manual adjustment and keeps the preview on failure', async () => {
  const prepareManual = jest
    .fn()
    .mockRejectedValueOnce(new Error('storage'))
    .mockResolvedValue(undefined);
  const { navigation, view: pending } = setup({ prepareManual });
  const view = await pending;
  await view.findByText('single panorama');
  await fireEvent.press(view.getByText('Adjust manually'));
  await view.findByText(/adjustments could not be opened/);
  expect(navigation.manual).not.toHaveBeenCalled();
  expect(view.getByText('single panorama')).toBeTruthy();
  await fireEvent.press(view.getByText('Adjust manually'));
  await waitFor(() => expect(navigation.manual).toHaveBeenCalledTimes(1));
  expect(prepareManual).toHaveBeenLastCalledWith(preview);
});

it('keeps the preview for retry after a failed save', async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error('storage'))
    .mockResolvedValue(undefined);
  const { controller, navigation, view: pending } = setup({ save });
  const view = await pending;
  await view.findByText('single panorama');
  await fireEvent.press(view.getByText('Use panorama'));
  await view.findByText(/could not be saved/);
  expect(controller.discard).not.toHaveBeenCalled();
  expect(navigation.onAccepted).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Use panorama'));
  await waitFor(() => expect(navigation.onAccepted).toHaveBeenCalledTimes(1));
});

it('aborts work and discards a late result after leaving', async () => {
  let finish!: (result: StitchedPreview) => void;
  let signal!: AbortSignal;
  const create = jest.fn((_profile: string, abort: AbortSignal) => {
    signal = abort;
    return new Promise<StitchedPreview>((resolve) => {
      finish = resolve;
    });
  });
  const { controller, view: pending } = setup({ create });
  const view = await pending;
  await waitFor(() => expect(create).toHaveBeenCalled());
  await view.unmount();
  expect(signal.aborted).toBe(true);
  finish(preview);
  await waitFor(() => expect(controller.discard).toHaveBeenCalledWith(preview));
});

it('offers retry and camera recovery without saving a failed stitch', async () => {
  const create = jest
    .fn()
    .mockRejectedValueOnce(new Error('decode'))
    .mockResolvedValue(preview);
  const { controller, view: pending } = setup({ create });
  const view = await pending;
  await view.findByText(/could not be stitched/);
  expect(view.getByText('Back to camera')).toBeTruthy();
  expect(controller.save).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Try again'));
  await view.findByText('single panorama');
  expect(create).toHaveBeenCalledTimes(2);
});
