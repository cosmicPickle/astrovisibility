import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import type { VisibilityMaskOperation } from './visibilityMask';
import {
  MaskEditorScreen,
  type MaskEditorCanvasProps,
  type MaskEditorController,
} from './MaskEditorScreen';

const panorama: ActivePanorama = {
  id: 'panorama-1',
  profileId: 'profile-1',
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

const initialOperation: VisibilityMaskOperation = {
  id: 'existing-region',
  kind: 'visiblePolygon',
  points: [
    { azimuthDegrees: 350, altitudeDegrees: 55 },
    { azimuthDegrees: 370, altitudeDegrees: 55 },
    { azimuthDegrees: 360, altitudeDegrees: 85 },
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
    <Text testID="operation-count">{props.operations.length}</Text>
    <Text testID="active-tool">{props.activeTool}</Text>
    <Text testID="preview-state">
      {props.showMaskPreview ? 'after' : 'before'}
    </Text>
    <Text testID="coverage">{JSON.stringify(props.mask.coveragePolygons)}</Text>
    <Pressable
      accessibilityLabel="Test add region"
      onPress={() =>
        props.onCommitPolygon([
          { azimuthDegrees: 10, altitudeDegrees: 10 },
          { azimuthDegrees: 30, altitudeDegrees: 10 },
          { azimuthDegrees: 20, altitudeDegrees: 35 },
        ])
      }
    />
    <Pressable
      accessibilityLabel="Test add stroke"
      onPress={() =>
        props.onCommitStroke([
          { azimuthDegrees: 15, altitudeDegrees: 20 },
          { azimuthDegrees: 16, altitudeDegrees: 24 },
        ])
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
  it('requires an explicit drawing tool and supports history, reset, and preview', async () => {
    const screen = await renderWithSafeArea(
      <MaskEditorScreen
        controller={controller()}
        navigation={{ goBack: jest.fn(), onSaved: jest.fn() }}
        profileId="profile-1"
        renderCanvas={TestCanvas}
      />,
    );
    await waitFor(() => screen.getByText('Draw visibility mask'));
    expect(screen.getByTestId('active-tool').props.children).toBe('pan');
    expect(screen.getByTestId('coverage').props.children).toBe(
      JSON.stringify([panorama.tiles[0]!.coveragePolygon]),
    );

    await fireEvent.press(screen.getByText('Mark visible sky'));
    await fireEvent.press(screen.getByLabelText('Test add region'));
    expect(screen.getByTestId('operation-count').props.children).toBe(1);
    await fireEvent.press(screen.getByText('Undo'));
    expect(screen.getByTestId('operation-count').props.children).toBe(0);
    await fireEvent.press(screen.getByText('Redo'));
    expect(screen.getByTestId('operation-count').props.children).toBe(1);

    await fireEvent.press(screen.getByText('Before'));
    expect(screen.getByTestId('preview-state').props.children).toBe('before');
    await fireEvent.press(screen.getByText('Reset'));
    expect(screen.getByTestId('operation-count').props.children).toBe(0);
  });

  it('loads an existing revision, applies ordered brush corrections, removes operations, and saves a new revision', async () => {
    const editorController = controller();
    editorController.load = jest.fn().mockResolvedValue({
      activeMask: {
        id: 'mask-1',
        profileId: 'profile-1',
        panoramaRevisionId: panorama.id,
        formatVersion: 1,
        createdAtUtc: '2026-08-19T10:00:00.000Z',
        coveragePolygons: [],
        operations: [initialOperation],
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
    await waitFor(() => screen.getByText('Edit visibility mask'));
    expect(screen.getByTestId('operation-count').props.children).toBe(1);
    await fireEvent.press(screen.getByText('Blocked brush'));
    await fireEvent.press(screen.getByLabelText('Test add stroke'));
    expect(screen.getByTestId('operation-count').props.children).toBe(2);
    await fireEvent.press(screen.getByLabelText('Remove blocked correction 2'));
    expect(screen.getByTestId('operation-count').props.children).toBe(1);
    await fireEvent.press(screen.getByText('Complete mask'));
    expect(
      screen.getByText(
        /all unmarked and uncaptured directions will be blocked/i,
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Save binary mask'));

    await waitFor(() => expect(editorController.save).toHaveBeenCalled());
    const saved = (editorController.save as jest.Mock).mock.calls[0][0];
    expect(saved.panoramaRevisionId).toBe(panorama.id);
    expect(saved.operations).toHaveLength(1);
    expect(saved.operations[0].kind).toBe('visiblePolygon');
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
