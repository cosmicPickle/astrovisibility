import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { PanoramaCaptureDraft } from '../storage/panoramaDraftRepository';
import {
  PanoramaAlignmentScreen,
  type PanoramaAlignmentAtlasProps,
  type PanoramaAlignmentController,
} from './PanoramaAlignmentScreen';

const tile = {
  id: 'tile-1',
  uri: 'file:///tile-1.jpg',
  widthPixels: 1000,
  heightPixels: 750,
  capturedAtUtc: '2026-08-21T10:00:00.000Z',
  orientationSnapshot: {
    trueHeadingDegrees: 120,
    estimatedAltitudeDegrees: 35,
    rollDegrees: 0,
    headingAccuracyDegrees: 2,
    rawRotation: null,
  },
  orientationConfidence: 'high' as const,
  sourceKind: 'camera' as const,
  reviewedPlacement: {
    centerAzimuthDegrees: 120,
    centerAltitudeDegrees: 35,
    rollDegrees: 0,
    horizontalFieldOfViewDegrees: 60,
    verticalFieldOfViewDegrees: 45,
  },
  coveragePolygon: [
    { azimuthDegrees: 90, altitudeDegrees: 10 },
    { azimuthDegrees: 150, altitudeDegrees: 10 },
    { azimuthDegrees: 150, altitudeDegrees: 60 },
  ],
};

const draft: PanoramaCaptureDraft = {
  id: 'draft-1',
  profileId: 'profile-1',
  formatVersion: 1,
  createdAtUtc: '2026-08-21T10:00:00.000Z',
  updatedAtUtc: '2026-08-21T10:00:00.000Z',
  tiles: [tile],
};

function Atlas(props: PanoramaAlignmentAtlasProps) {
  return (
    <View>
      <Text>gesture atlas</Text>
      <Text onPress={() => props.onSelectTile('tile-1')}>select tile</Text>
      <Text>{props.selectedTileId ?? 'none'}</Text>
    </View>
  );
}

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

describe('PanoramaAlignmentScreen', () => {
  it('selects and nudges a tile with plain directional controls', async () => {
    const updateTilePlacement = jest.fn().mockResolvedValue(draft);
    const controller: PanoramaAlignmentController = {
      load: jest.fn().mockResolvedValue({ draft, profileName: 'Balcony' }),
      updateTilePlacement,
      completeDraft: jest.fn(),
    };

    const view = await renderWithSafeArea(
      <PanoramaAlignmentScreen
        controller={controller}
        navigation={{ backToCapture: jest.fn(), onAccepted: jest.fn() }}
        profileId="profile-1"
        renderAtlas={Atlas}
      />,
    );

    await view.findByText('Align tiles');
    await fireEvent.press(view.getByLabelText('Move selected tile up'));

    await waitFor(() => expect(updateTilePlacement).toHaveBeenCalledTimes(1));
    expect(updateTilePlacement.mock.calls[0]![2]).toMatchObject({
      centerAltitudeDegrees: 36,
      centerAzimuthDegrees: 120,
    });
    expect(view.queryByText(/Az [+-]|Alt [+-]|Roll/i)).toBeNull();
  });

  it('returns to capture or accepts the immutable panorama', async () => {
    const backToCapture = jest.fn();
    const onAccepted = jest.fn();
    const completeDraft = jest.fn().mockResolvedValue(undefined);
    const controller: PanoramaAlignmentController = {
      load: jest.fn().mockResolvedValue({ draft, profileName: 'Balcony' }),
      updateTilePlacement: jest.fn(),
      completeDraft,
    };

    const view = await renderWithSafeArea(
      <PanoramaAlignmentScreen
        controller={controller}
        navigation={{ backToCapture, onAccepted }}
        profileId="profile-1"
        renderAtlas={Atlas}
      />,
    );

    await view.findByText('Align tiles');
    await fireEvent.press(view.getByText('Back to camera'));
    expect(backToCapture).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByText('Use panorama'));
    await waitFor(() => expect(completeDraft).toHaveBeenCalledWith('draft-1'));
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });
});
