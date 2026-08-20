import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CapturedProofTile } from './captureSession';
import {
  PanoramaCaptureScreen,
  refreshCapturePermissions,
  type PanoramaCaptureController,
  type PanoramaCaptureServices,
} from './PanoramaCaptureScreen';

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: false }, jest.fn()],
}));
jest.mock('./useCaptureOrientation', () => ({
  useCaptureOrientation: () => ({
    motionAvailable: false,
    orientation: {
      trueHeadingDegrees: 180,
      headingAccuracyDegrees: null,
      estimatedAltitudeDegrees: 30,
      rollDegrees: 0,
      rawRotation: null,
    },
    sensorError: 'Motion unavailable; place imported images manually.',
    setOrientation: jest.fn(),
  }),
}));

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
    estimatedAltitudeDegrees: 30,
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
    widthPixels: 1200,
    heightPixels: 900,
    fileExtension: 'jpg',
  }),
  requestCameraPermission: jest.fn().mockResolvedValue(false),
  requestLocationPermission: jest.fn().mockResolvedValue(false),
  takePicture: jest.fn(),
});

describe('PanoramaCaptureScreen', () => {
  it('rechecks revocable permissions when capture returns to the foreground', async () => {
    const native: PanoramaCaptureServices = {
      ...services(),
      getCameraPermission: jest.fn().mockResolvedValue(false),
      getLocationPermission: jest.fn().mockResolvedValue(false),
    };

    await expect(refreshCapturePermissions(native)).resolves.toEqual({
      cameraGranted: false,
      locationGranted: false,
    });
    expect(native.getCameraPermission).toHaveBeenCalledTimes(1);
    expect(native.getLocationPermission).toHaveBeenCalledTimes(1);
  });

  it('explains permissions before prompting and recovers from denial through image import', async () => {
    const native = services();
    const controller: PanoramaCaptureController = {
      load: jest.fn().mockResolvedValue({
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

    expect(screen.getByText(/requested only after you continue/i)).toBeTruthy();
    expect(native.requestCameraPermission).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText('Start capture')));
    await waitFor(() => screen.getByText('Camera access unavailable'));
    expect(
      screen.getByText(/import images and place them manually/i),
    ).toBeTruthy();
    expect(screen.queryByText(/Suggested 25% overlap/i)).toBeNull();
    expect(screen.queryByText('Az −5°')).toBeNull();
    expect(screen.queryByText('Az +5°')).toBeNull();
    expect(
      screen.getByLabelText(
        /red cardinal directions, 0 green captured footprints, and a blue live capture footprint/i,
      ),
    ).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText('Import image')));
    await waitFor(() => expect(controller.addTile).toHaveBeenCalledTimes(1));
    expect(screen.getByText('1 tile · 360° not required')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Review')));
    await waitFor(() => screen.getByText(/Manual placement/i));
  });

  it('resumes a durable draft, applies reviewed correction, and atomically completes it', async () => {
    const onSaved = jest.fn();
    const controller: PanoramaCaptureController = {
      load: jest.fn().mockResolvedValue({
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
});
