import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Camera } from 'expo-camera';
import { AppState } from 'react-native';
import { ContinuousCaptureScreen } from './ContinuousCaptureScreen';

jest.mock(
  './NativeContinuousCamera',
  () => ({ NativeContinuousCamera: 'ContinuousCamera' }),
  { virtual: true },
);
jest.mock('./useDevicePose', () => ({
  useDevicePose: () => ({
    pose: null,
    fieldOfView: { horizontalDegrees: 55, verticalDegrees: 69 },
  }),
}));
jest.mock('./PoseDrivenCaptureView', () => ({
  PoseDrivenCaptureView: ({
    previewOverride,
    actionsOverride,
    statusText,
  }: {
    previewOverride: React.ReactNode;
    actionsOverride: React.ReactNode;
    statusText: string;
  }) => {
    const { View, Text } = jest.requireActual('react-native');
    return (
      <View>
        {previewOverride}
        <Text>{statusText}</Text>
        {actionsOverride}
      </View>
    );
  },
}));
jest.mock('expo-camera', () => ({
  Camera: {
    getCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    requestCameraPermissionsAsync: jest
      .fn()
      .mockResolvedValue({ granted: true }),
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual('react-native');
    return <View>{children}</View>;
  },
}));

const profile = {
  id: 'p',
  name: 'Synthetic',
  latitudeDegreesNorth: 0,
  longitudeDegreesEast: 0,
  elevationMetersAboveMeanSeaLevel: 0,
  timeZoneId: 'UTC',
  createdAtUtc: '',
  updatedAtUtc: '',
};
const draft = {
  id: 'd',
  profileId: 'p',
  formatVersion: 1,
  createdAtUtc: '',
  updatedAtUtc: '',
  tiles: [],
};
const frame = {
  sequence: 1,
  uri: 'file:///private/frame.jpg',
  widthPixels: 960,
  heightPixels: 1280,
  horizontalDegrees: 55,
  verticalDegrees: 69,
  pose: {
    accuracy: 3,
    timestampNanoseconds: 1,
    right: { east: 1, north: 0, up: 0 },
    up: { east: 0, north: -1, up: 0 },
    forward: { east: 0, north: 0, up: 1 },
  },
  sensorPose: {
    accuracy: 3,
    timestampNanoseconds: 1,
    forward: { east: 0, north: 0, up: 1 },
    right: {
      east: Math.cos(Math.PI / 18),
      north: -Math.sin(Math.PI / 18),
      up: 0,
    },
    up: {
      east: -Math.sin(Math.PI / 18),
      north: -Math.cos(Math.PI / 18),
      up: 0,
    },
  },
};
beforeEach(() => {
  AppState.currentState = 'active';
});
function setup(
  save = jest
    .fn()
    .mockImplementation(async (_id, tile) => ({ ...draft, tiles: [tile] })),
) {
  const controller = {
    load: jest.fn().mockResolvedValue({
      profile,
      profileName: profile.name,
      draft,
      activePanorama: null,
    }),
    createDraft: jest.fn(),
    addTile: save,
    updateTilePlacement: jest.fn(),
    discardDraft: jest.fn(),
    completeDraft: jest.fn(),
  };
  const navigation = {
    goBack: jest.fn(),
    onAlign: jest.fn(),
    onSaved: jest.fn(),
  };
  return {
    controller,
    navigation,
    pending: render(
      <ContinuousCaptureScreen
        profileId="p"
        controller={controller}
        navigation={navigation}
      />,
    ),
  };
}
it('starts once and waits for the native stop and durable image before stitching', async () => {
  jest.mocked(Camera.requestCameraPermissionsAsync).mockClear();
  let resolveSave!: (value: unknown) => void;
  const save = jest.fn(
    (...args: [string, unknown]) =>
      new Promise((resolve) => {
        expect(args).toHaveLength(2);
        resolveSave = resolve;
      }),
  );
  const { pending, navigation } = setup(save);
  const screen = await pending;
  await fireEvent.press(await screen.findByText('Start'));
  expect(Camera.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  const camera = () => screen.getByTestId('continuous-camera');
  expect(camera().props.recording).toBe(true);
  await act(async () => {
    camera().props.onFrame({ nativeEvent: frame });
  });
  const savedTile = save.mock.calls[0]![1] as {
    orientationSnapshot: { rollDegrees: number };
    reviewedPlacement: { rollDegrees: number };
  };
  expect(savedTile.orientationSnapshot.rollDegrees).toBeCloseTo(10);
  expect(savedTile.reviewedPlacement.rollDegrees).toBeCloseTo(0);
  await fireEvent.press(screen.getByText('Stop'));
  expect(camera().props.recording).toBe(false);
  await act(async () => {
    camera().props.onStopped();
  });
  expect(navigation.onAlign).not.toHaveBeenCalled();
  await act(async () =>
    resolveSave({ ...draft, tiles: [save.mock.calls[0]![1]] }),
  );
  await waitFor(() => expect(navigation.onAlign).toHaveBeenCalledTimes(1));
});
it('keeps a failed image out of the map and does not finish an empty draft', async () => {
  const { pending, navigation } = setup(
    jest.fn().mockRejectedValue(new Error('disk')),
  );
  const screen = await pending;
  await fireEvent.press(await screen.findByText('Start'));
  const camera = () => screen.getByTestId('continuous-camera');
  await act(async () => {
    camera().props.onFrame({ nativeEvent: frame });
  });
  await screen.findByText(/could not be saved/);
  expect(camera().props.acknowledgement).toBe(-1);
  expect(navigation.onAlign).not.toHaveBeenCalled();
});
it('pauses on interruption without completing and allows an explicit restart', async () => {
  const { pending, navigation } = setup();
  const screen = await pending;
  await fireEvent.press(await screen.findByText('Start'));
  const camera = () => screen.getByTestId('continuous-camera');
  await act(async () => {
    camera().props.onInterruption();
  });
  expect(camera().props.recording).toBe(false);
  expect(navigation.onAlign).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Start'));
  expect(camera().props.recording).toBe(true);
});

it('does not start collecting frames while the app is in the background', async () => {
  const { pending } = setup();
  const screen = await pending;
  await screen.findByText('Start');
  AppState.currentState = 'background';
  await fireEvent.press(screen.getByText('Start'));
  expect(screen.getByTestId('continuous-camera').props.recording).toBe(false);
  await screen.findByText(/Return to the app/);
});
