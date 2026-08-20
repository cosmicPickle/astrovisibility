import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CapturedProofTile } from './captureSession';
import {
  PanoramaCaptureScreen,
  refreshCapturePermissions,
  type PanoramaCaptureController,
  type PanoramaCaptureServices,
} from './PanoramaCaptureScreen';

jest.mock('expo-camera', () => ({
  Camera: {},
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: false }, jest.fn()],
}));
jest.mock('../sky/PlanetariumScene', () => ({
  PlanetariumScene: 'PlanetariumScene',
}));
let mockCaptureAltitudeDegrees = 60;
jest.mock('./useDevicePose', () => ({
  useDevicePose: () => {
    const radians = (mockCaptureAltitudeDegrees * Math.PI) / 180;
    return {
      available: true,
      error: null,
      fieldOfView: {
        approximate: false,
        horizontalDegrees: 55,
        verticalDegrees: 69,
      },
      pose: {
        accuracy: 3,
        forward: {
          east: 0,
          north: Math.cos(radians),
          up: Math.sin(radians),
        },
        right: { east: 1, north: 0, up: 0 },
        timestampNanoseconds: 1,
        up: {
          east: 0,
          north: -Math.sin(radians),
          up: Math.cos(radians),
        },
      },
    };
  },
}));

const profile = {
  id: 'profile-1',
  name: 'Bedroom window',
  latitudeDegreesNorth: 42.7,
  longitudeDegreesEast: 23.3,
  elevationMetersAboveMeanSeaLevel: 550,
  timeZoneId: 'Europe/Sofia',
  locationAccuracyMeters: null,
  createdAtUtc: '2026-08-19T12:00:00.000Z',
  updatedAtUtc: '2026-08-19T12:00:00.000Z',
};

const importedTile: CapturedProofTile = {
  id: 'tile-1',
  uri: 'owned://draft/tile-1.jpg',
  widthPixels: 1200,
  heightPixels: 900,
  capturedAtUtc: '2026-08-19T12:01:00.000Z',
  sourceKind: 'import',
  orientationConfidence: 'manual',
  orientationSnapshot: {
    trueHeadingDegrees: 180,
    headingAccuracyDegrees: null,
    estimatedAltitudeDegrees: 50,
    rollDegrees: 0,
    rawRotation: null,
  },
  reviewedPlacement: {
    centerAzimuthDegrees: 180,
    centerAltitudeDegrees: 30,
    rollDegrees: 0,
    horizontalFieldOfViewDegrees: 62,
    verticalFieldOfViewDegrees: 46.5,
  },
  coveragePolygon: [
    { azimuthDegrees: 149, altitudeDegrees: 6.75 },
    { azimuthDegrees: 211, altitudeDegrees: 6.75 },
    { azimuthDegrees: 211, altitudeDegrees: 53.25 },
    { azimuthDegrees: 149, altitudeDegrees: 53.25 },
  ],
};

const emptyDraft = {
  id: 'draft-1',
  profileId: 'profile-1',
  formatVersion: 1,
  createdAtUtc: '2026-08-19T12:00:00.000Z',
  updatedAtUtc: '2026-08-19T12:00:00.000Z',
  tiles: [],
};

const withTile = { ...emptyDraft, tiles: [importedTile] };

const renderScreen = (
  controller: PanoramaCaptureController,
  services: PanoramaCaptureServices,
  onSaved = jest.fn(),
) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 24, bottom: 24, left: 0, right: 0 },
      }}
    >
      <PanoramaCaptureScreen
        controller={controller}
        navigation={{ goBack: jest.fn(), onSaved }}
        profileId="profile-1"
        services={services}
      />
    </SafeAreaProvider>,
  );

const services = (): PanoramaCaptureServices => ({
  openSettings: jest.fn(),
  pickImage: jest.fn().mockResolvedValue({
    uri: 'temp://import.jpg',
    widthPixels: 900,
    heightPixels: 1600,
    fileExtension: 'jpg',
  }),
  requestCameraPermission: jest.fn().mockResolvedValue(false),
  takePicture: jest.fn(),
});

describe('PanoramaCaptureScreen', () => {
  beforeEach(() => {
    mockCaptureAltitudeDegrees = 60;
  });

  it('rechecks revocable permissions when capture returns to the foreground', async () => {
    const native: PanoramaCaptureServices = {
      ...services(),
      getCameraPermission: jest.fn().mockResolvedValue(false),
    };

    await expect(refreshCapturePermissions(native)).resolves.toEqual({
      cameraGranted: false,
    });
    expect(native.getCameraPermission).toHaveBeenCalledTimes(1);
  });

  it('explains permissions before prompting and recovers from denial through image import', async () => {
    const native = services();
    const controller: PanoramaCaptureController = {
      load: jest.fn().mockResolvedValue({
        profile,
        profileName: 'Bedroom window',
        activePanorama: null,
        draft: null,
      }),
      createDraft: jest.fn().mockResolvedValue(emptyDraft),
      addTile: jest.fn().mockResolvedValue(withTile),
      updateTilePlacement: jest.fn(),
      discardDraft: jest.fn(),
      completeDraft: jest.fn(),
    };
    const screen = await renderScreen(controller, native);
    await waitFor(() => screen.getByText('Capture surroundings'));

    expect(screen.getByText(/No additional location permission/i)).toBeTruthy();
    expect(native.requestCameraPermission).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText('Start capture')));
    await waitFor(() => screen.getByText('Camera access unavailable'));
    expect(
      screen.getByText(/Import an image or enable camera access/i),
    ).toBeTruthy();
    expect(screen.queryByText(/Suggested 25% overlap/i)).toBeNull();
    expect(screen.queryByText('Az −5°')).toBeNull();
    expect(screen.queryByText('Az +5°')).toBeNull();
    expect(screen.getByLabelText('Current camera footprint')).toBeTruthy();
    expect(
      screen.getByText(/55° × 69° camera FOV · device metadata/i),
    ).toBeTruthy();
    expect(screen.getByText('0 captured')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByLabelText('Live camera preview').props.style,
      ).flex,
    ).toBe(44);
    expect(
      StyleSheet.flatten(
        screen.getByLabelText('Phone-directed sky view').props.style,
      ).flex,
    ).toBe(56);

    await act(async () => fireEvent.press(screen.getByText('Import')));
    await waitFor(() => expect(controller.addTile).toHaveBeenCalledTimes(1));
    expect(controller.addTile).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({
        reviewedPlacement: expect.objectContaining({
          horizontalFieldOfViewDegrees: 55,
          verticalFieldOfViewDegrees: 69,
        }),
      }),
    );
    expect(screen.getByText('1 tile · 360° not required')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Review')));
    await waitFor(() => screen.getByText(/Manual placement/i));
  });

  it('resumes a durable draft, applies reviewed correction, and atomically completes it', async () => {
    const onSaved = jest.fn();
    const controller: PanoramaCaptureController = {
      load: jest.fn().mockResolvedValue({
        profile,
        profileName: 'Bedroom window',
        activePanorama: null,
        draft: withTile,
      }),
      createDraft: jest.fn(),
      addTile: jest.fn(),
      updateTilePlacement: jest.fn().mockResolvedValue({
        ...withTile,
        tiles: [
          {
            ...importedTile,
            reviewedPlacement: {
              ...importedTile.reviewedPlacement,
              centerAzimuthDegrees: 185,
            },
          },
        ],
      }),
      discardDraft: jest.fn(),
      completeDraft: jest.fn().mockResolvedValue(undefined),
    };
    const screen = await renderScreen(controller, services(), onSaved);
    await waitFor(() => screen.getByText('Resume 1-tile draft'));
    fireEvent.press(screen.getByText('Review draft'));
    await waitFor(() => screen.getByText('Review tile alignment'));
    expect(screen.queryByText('Az −5°')).toBeNull();
    expect(screen.queryByText('Az +5°')).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Alt +5°')));
    await waitFor(() =>
      expect(controller.updateTilePlacement).toHaveBeenCalledWith(
        'draft-1',
        'tile-1',
        expect.objectContaining({ centerAltitudeDegrees: 35 }),
      ),
    );
    await act(async () => fireEvent.press(screen.getByText('Save panorama')));
    await waitFor(() =>
      expect(controller.completeDraft).toHaveBeenCalledWith('draft-1'),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('allows an interrupted draft to be discarded explicitly', async () => {
    const controller: PanoramaCaptureController = {
      load: jest.fn().mockResolvedValue({
        profile,
        profileName: 'Bedroom window',
        activePanorama: null,
        draft: withTile,
      }),
      createDraft: jest.fn(),
      addTile: jest.fn(),
      updateTilePlacement: jest.fn(),
      discardDraft: jest.fn().mockResolvedValue(undefined),
      completeDraft: jest.fn(),
    };
    const screen = await renderScreen(controller, services());
    await waitFor(() => screen.getByText('Discard draft'));
    await act(async () => fireEvent.press(screen.getByText('Discard draft')));
    await waitFor(() => screen.getByText('Discard'));
    await act(async () => fireEvent.press(screen.getByText('Discard')));
    await waitFor(() =>
      expect(controller.discardDraft).toHaveBeenCalledWith('draft-1'),
    );
  });

  it.each([
    [45, /bottom of the blue frame.*20°/i],
    [85, /aim no higher than 80°/i],
  ])(
    'blocks camera capture at %i degrees and explains the valid altitude range',
    async (altitudeDegrees, expectedMessage) => {
      mockCaptureAltitudeDegrees = altitudeDegrees;
      const native = {
        ...services(),
        requestCameraPermission: jest.fn().mockResolvedValue(true),
        takePicture: jest.fn(),
      };
      const controller: PanoramaCaptureController = {
        load: jest.fn().mockResolvedValue({
          profile,
          profileName: 'Bedroom window',
          activePanorama: null,
          draft: null,
        }),
        createDraft: jest.fn().mockResolvedValue(emptyDraft),
        addTile: jest.fn(),
        updateTilePlacement: jest.fn(),
        discardDraft: jest.fn(),
        completeDraft: jest.fn(),
      };
      const screen = await renderScreen(controller, native);
      await waitFor(() => screen.getByText('Capture surroundings'));
      await act(async () => fireEvent.press(screen.getByText('Start capture')));
      await waitFor(() => screen.getByText(expectedMessage));

      expect(
        screen.getByRole('button', { name: 'Capture' }).props
          .accessibilityState,
      ).toEqual({ disabled: true });
      fireEvent.press(screen.getByRole('button', { name: 'Capture' }));
      expect(native.takePicture).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Import' })).toBeTruthy();
    },
  );
});
