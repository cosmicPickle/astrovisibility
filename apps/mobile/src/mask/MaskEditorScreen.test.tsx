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
    expect(screen.getByTestId('coverage').props.children).toBe(
      JSON.stringify([panorama.tiles[0]!.coveragePolygon]),
    );
    expect(screen.getByTestId('operation-count').props.children).toBe(1);
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
    expect(screen.getByTestId('operation-count').props.children).toBe(2);
    await fireEvent.press(screen.getByText('Erase'));
    await fireEvent.press(screen.getByLabelText('Test add stroke'));
    expect(screen.getByTestId('operation-count').props.children).toBe(3);
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
    expect(saved.operations).toHaveLength(1);
    expect(saved.operations[0]).toMatchObject({
      id: 'coverage-1',
      kind: 'visiblePolygon',
    });
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
        coveragePolygons: [panorama.tiles[0]!.coveragePolygon],
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
    await waitFor(() => screen.getByText('Edit obstacle mask'));
    expect(screen.getByTestId('operation-count').props.children).toBe(1);
    await fireEvent.press(screen.getByText('Draw'));
    await fireEvent.press(screen.getByLabelText('Test add stroke'));
    expect(screen.getByTestId('operation-count').props.children).toBe(2);
    await fireEvent.press(screen.getByText('Erase'));
    await fireEvent.press(screen.getByLabelText('Test add stroke'));
    expect(screen.getByTestId('operation-count').props.children).toBe(3);
    await fireEvent.press(screen.getByText('Complete mask'));
    expect(
      screen.getByText(/red areas and uncaptured directions will be blocked/i),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Save binary mask'));

    await waitFor(() => expect(editorController.save).toHaveBeenCalled());
    const saved = (editorController.save as jest.Mock).mock.calls[0][0];
    expect(saved.panoramaRevisionId).toBe(panorama.id);
    expect(saved.operations).toHaveLength(3);
    expect(saved.operations[0].kind).toBe('visiblePolygon');
    expect(saved.operations[1]).toMatchObject({
      angularRadiusDegrees: 0.5,
      kind: 'blockedStroke',
    });
    expect(saved.operations[2]).toMatchObject({
      angularRadiusDegrees: 0.5,
      kind: 'visibleStroke',
    });
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
