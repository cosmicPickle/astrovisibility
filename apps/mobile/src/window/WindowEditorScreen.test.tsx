import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  WindowEditorScreen,
  type WindowEditorController,
} from './WindowEditorScreen';
import { createInitialWindow } from './windowGeometry';
import type { WindowEditorCanvasProps } from './WindowEditorCanvas';

const definition = createInitialWindow({
  azimuthDegrees: 0,
  altitudeDegrees: 30,
});
async function setup(saved = true, creation = false) {
  const controller: WindowEditorController = {
    load: jest.fn().mockResolvedValue({
      definition: saved ? definition : null,
      hasMask: true,
      panorama: {
        id: 'p',
        profileId: 'profile',
        uri: 'synthetic',
        tiles: [],
        widthPixels: 8,
        heightPixels: 8,
        coverageBitset: new Uint8Array(8).fill(255),
      },
    }),
    save: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const navigation = { goBack: jest.fn(), onSaved: jest.fn() };
  let canvasProps: WindowEditorCanvasProps;
  const screen = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { width: 360, height: 640, x: 0, y: 0 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <WindowEditorScreen
        profileId="profile"
        controller={controller}
        navigation={navigation}
        creation={creation}
        renderCanvas={(props) => {
          canvasProps = props;
          return <Text>Test panorama</Text>;
        }}
      />
    </SafeAreaProvider>,
  );
  return { screen, controller, navigation, getCanvas: () => canvasProps };
}

it('shows a read-only angular span across north and updates through 180 degrees after corner edits', async () => {
  const { screen, getCanvas } = await setup();
  await waitFor(() =>
    expect(screen.getByLabelText('Angular width').props.value).toBe('30.00'),
  );
  expect(screen.getByLabelText('Angular width').props.editable).toBe(false);
  for (const [rightAzimuthDegrees, expected] of [
    [164.99, '179.99'],
    [165, '180.00'],
    [165.01, '180.01'],
    [185, '200.00'],
  ] as const) {
    await act(() =>
      getCanvas().onChange({ ...definition, rightAzimuthDegrees }),
    );
    expect(screen.getByLabelText('Angular width').props.value).toBe(expected);
  }
  await fireEvent.changeText(
    screen.getByLabelText('Approximate window width'),
    '160',
  );
  expect(screen.getByLabelText('Angular width').props.value).toBe('200.00');
});

it('shows the computed field when defining a new window after mask creation', async () => {
  const { screen } = await setup(false, true);
  await fireEvent.press(await screen.findByText('Define window'));
  await waitFor(() =>
    expect(screen.getByLabelText('Angular width').props.value).toBe('30.00'),
  );
  expect(screen.getByLabelText('Angular width').props.editable).toBe(false);
});

it('offers the optional step after creation and allows skipping without writing', async () => {
  const { screen, controller, navigation } = await setup(false, true);
  await waitFor(() => expect(screen.getByText('Skip')).toBeTruthy());
  await fireEvent.press(screen.getByText('Skip'));
  expect(navigation.goBack).toHaveBeenCalled();
  expect(controller.save).not.toHaveBeenCalled();
});
it('reopens dimensions, validates width, and keeps edits available after failure', async () => {
  const { screen, controller, navigation } = await setup();
  await waitFor(() =>
    expect(screen.getByLabelText('Approximate window width').props.value).toBe(
      '100',
    ),
  );
  await fireEvent.changeText(
    screen.getByLabelText('Approximate window width'),
    '0',
  );
  await fireEvent.press(screen.getByText('Save window'));
  expect(controller.save).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText('Approximate window width'),
    '150',
  );
  (controller.save as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  await fireEvent.press(screen.getByText('Save window'));
  await waitFor(() =>
    expect(screen.getByText(/Your edits remain available/)).toBeTruthy(),
  );
  expect(navigation.onSaved).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Save window'));
  await waitFor(() => expect(navigation.onSaved).toHaveBeenCalled());
  expect(controller.save).toHaveBeenLastCalledWith('profile', 'p', {
    ...definition,
    widthMeters: 1.5,
  });
});
it('cancels without changing the definition and removes it explicitly', async () => {
  const { screen, controller, navigation } = await setup();
  await waitFor(() => expect(screen.getByText('Remove window')).toBeTruthy());
  await fireEvent.press(screen.getByText('Cancel'));
  expect(navigation.goBack).toHaveBeenCalled();
  expect(controller.save).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Remove window'));
  await waitFor(() =>
    expect(controller.remove).toHaveBeenCalledWith('profile', 'p'),
  );
  expect(navigation.onSaved).toHaveBeenCalled();
});
