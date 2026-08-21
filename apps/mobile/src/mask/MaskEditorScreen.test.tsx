import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import {
  MaskEditorScreen,
  type MaskEditorCanvasProps,
  type MaskEditorController,
} from './MaskEditorScreen';

jest.mock('../panorama/directionalAtlasImage', () => ({
  createMaskImageFile: () => 'file:///temporary/mask.png',
}));

const panorama: ActivePanorama = {
  id: 'panorama-1',
  profileId: 'profile-1',
  coverageBitset: new Uint8Array(8).fill(0xff),
  heightPixels: 8,
  projection: 'azimuthal-equidistant-upper-hemisphere',
  uri: 'file:///panorama-atlas.png',
  widthPixels: 8,
  tiles: [
    {
      id: 'tile-1',
      uri: 'file:///panorama.jpg',
      centerAzimuthDegrees: 355,
      centerAltitudeDegrees: 70,
      rollDegrees: 0,
      horizontalFieldOfViewDegrees: 40,
      verticalFieldOfViewDegrees: 40,
      widthPixels: 1600,
      heightPixels: 1200,
      coveragePolygon: [
        { azimuthDegrees: 340, altitudeDegrees: 52 },
        { azimuthDegrees: 370, altitudeDegrees: 58 },
        { azimuthDegrees: 365, altitudeDegrees: 88 },
      ],
    },
  ],
};

const renderWithSafeArea = (element: ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { height: 800, width: 400, x: 0, y: 0 },
        insets: { bottom: 24, left: 0, right: 0, top: 24 },
      }}
    >
      {element}
    </SafeAreaProvider>,
  );

const TestCanvas = (props: MaskEditorCanvasProps) => (
  <View>
    <Text testID="operation-count">{props.mask.operations.length}</Text>
    <Text testID="active-tool">{props.activeTool}</Text>
    <Text testID="coverage">{JSON.stringify(props.mask.coveragePolygons)}</Text>
    <Pressable
      accessibilityLabel="Test add stroke"
      onPress={() =>
        props.onCommitStroke(
          [
            { azimuthDegrees: 15, altitudeDegrees: 20 },
            { azimuthDegrees: 16, altitudeDegrees: 24 },
          ],
          0.5,
        )
      }
    />
  </View>
);

const controller = (): MaskEditorController => ({
  load: jest.fn().mockResolvedValue({
    activeMask: null,
    panorama,
    profileName: 'Terrace',
  }),
  save: jest.fn().mockResolvedValue(undefined),
});

describe('MaskEditorScreen', () => {
  it('starts with a visible coverage base and exposes only obstacle brush tools', async () => {
    const editorController = controller();
    const screen = await renderWithSafeArea(
      <MaskEditorScreen
        controller={editorController}
        navigation={{ goBack: jest.fn(), onSaved: jest.fn() }}
        profileId="profile-1"
        renderCanvas={TestCanvas}
      />,
    );
    await waitFor(() => screen.getByText('Paint obstacles'));
    expect(screen.getByTestId('active-tool').props.children).toBe(
      'blockedStroke',
    );
    expect(screen.getByTestId('coverage').props.children).toBe('[]');
    expect(screen.getByTestId('operation-count').props.children).toBe(0);
    expect(screen.getByText('Draw')).toBeTruthy();
    expect(screen.getByText('Erase')).toBeTruthy();
    expect(screen.getByText(/Brush size/)).toBeTruthy();
    expect(screen.queryByText('Pan / zoom')).toBeNull();
    expect(screen.queryByText('Mark visible sky')).toBeNull();
    expect(screen.queryByText('Undo')).toBeNull();
    expect(screen.queryByText('Redo')).toBeNull();
    expect(screen.queryByText('Reset')).toBeNull();
    expect(screen.queryByText('Before')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Test add stroke'));
    expect(screen.getByTestId('operation-count').props.children).toBe(1);
    await fireEvent.press(screen.getByText('Erase'));
    await fireEvent.press(screen.getByLabelText('Test add stroke'));
    expect(screen.getByTestId('operation-count').props.children).toBe(2);
  });

  it('can complete captured coverage without painting an obstacle', async () => {
    const editorController = controller();
    const screen = await renderWithSafeArea(
      <MaskEditorScreen
        controller={editorController}
        navigation={{ goBack: jest.fn(), onSaved: jest.fn() }}
        profileId="profile-1"
        renderCanvas={TestCanvas}
      />,
    );
    await waitFor(() => screen.getByText('Paint obstacles'));

    await fireEvent.press(screen.getByText('Complete mask'));
    await fireEvent.press(screen.getByText('Save binary mask'));

    await waitFor(() => expect(editorController.save).toHaveBeenCalled());
    const saved = (editorController.save as jest.Mock).mock.calls[0][0];
    expect(saved).toMatchObject({
      heightPixels: 8,
      projection: 'azimuthal-equidistant-upper-hemisphere',
      temporaryUri: 'file:///temporary/mask.png',
      widthPixels: 8,
    });
    expect(saved.blockedBitset).toBeInstanceOf(Uint8Array);
  });

  it('loads an existing revision, applies ordered brush corrections, removes operations, and saves a new revision', async () => {
    const editorController = controller();
    editorController.load = jest.fn().mockResolvedValue({
      activeMask: {
        id: 'mask-1',
        profileId: 'profile-1',
        panoramaRevisionId: panorama.id,
        formatVersion: 2,
        createdAtUtc: '2026-08-19T10:00:00.000Z',
        coveragePolygons: [],
        operations: [],
        raster: {
          blockedBitset: new Uint8Array(8),
          heightPixels: 8,
          uri: 'file:///mask.png',
          widthPixels: 8,
        },
      },
      panorama,
      profileName: 'Terrace',
    });
    const onSaved = jest.fn();
    const screen = await renderWithSafeArea(
      <MaskEditorScreen
        controller={editorController}
        navigation={{ goBack: jest.fn(), onSaved }}
        profileId="profile-1"
        renderCanvas={TestCanvas}
      />,
    );
    await waitFor(() => screen.getByText('Edit obstacle mask'));
    expect(screen.getByTestId('operation-count').props.children).toBe(0);
    await fireEvent.press(screen.getByText('Draw'));
    await fireEvent.press(screen.getByLabelText('Test add stroke'));
    expect(screen.getByTestId('operation-count').props.children).toBe(1);
    await fireEvent.press(screen.getByText('Erase'));
    await fireEvent.press(screen.getByLabelText('Test add stroke'));
    expect(screen.getByTestId('operation-count').props.children).toBe(2);
    await fireEvent.press(screen.getByText('Complete mask'));
    expect(
      screen.getByText(
        /painted obstacles and uncaptured directions will be blocked/i,
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Save binary mask'));

    await waitFor(() => expect(editorController.save).toHaveBeenCalled());
    const saved = (editorController.save as jest.Mock).mock.calls[0][0];
    expect(saved.panoramaRevisionId).toBe(panorama.id);
    expect(saved.blockedBitset).toBeInstanceOf(Uint8Array);
    expect(saved.temporaryUri).toBe('file:///temporary/mask.png');
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows a recoverable error when no active panorama exists', async () => {
    const editorController = controller();
    editorController.load = jest.fn().mockResolvedValue({
      activeMask: null,
      panorama: null,
      profileName: 'Terrace',
    });
    const screen = await renderWithSafeArea(
      <MaskEditorScreen
        controller={editorController}
        navigation={{ goBack: jest.fn(), onSaved: jest.fn() }}
        profileId="profile-1"
        renderCanvas={TestCanvas}
      />,
    );
    await waitFor(() => screen.getByText('Panorama required'));
    expect(screen.getByText(/capture and save a panorama first/i)).toBeTruthy();
  });
});
