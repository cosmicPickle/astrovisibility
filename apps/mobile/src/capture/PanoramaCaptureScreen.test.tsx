import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CapturedProofTile } from './captureSession';
import {
  PANORAMA_CAPTURE_PICTURE_OPTIONS,
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
let mockPoseReadiness = 'ready';
const mockPose = () => {
  const radians = (mockCaptureAltitudeDegrees * Math.PI) / 180;
  return {
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
  };
};
jest.mock('./useDevicePose', () => ({
  useDevicePose: () => {
    return {
      available: true,
      error: null,
      fieldOfView: {
        approximate: false,
        horizontalDegrees: 55,
        verticalDegrees: 69,
      },
      getCapturePose: () => (mockPoseReadiness === 'ready' ? mockPose() : null),
      pose: mockPose(),
      readiness: mockPoseReadiness,
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

const capturedTile: CapturedProofTile = {
  id: 'tile-1',
  uri: 'owned://draft/tile-1.jpg',
  widthPixels: 1200,
  heightPixels: 900,
  capturedAtUtc: '2026-08-19T12:01:00.000Z',
  sourceKind: 'camera',
  orientationConfidence: 'high',
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

const withTile = { ...emptyDraft, tiles: [capturedTile] };

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
  requestCameraPermission: jest.fn().mockResolvedValue(false),
  takePicture: jest.fn(),
});

describe('PanoramaCaptureScreen', () => {
  beforeEach(() => {
    mockCaptureAltitudeDegrees = 60;
    mockPoseReadiness = 'ready';
  });

  it('disables the native shutter sound for panorama photos', () => {
    expect(PANORAMA_CAPTURE_PICTURE_OPTIONS).toEqual({
      quality: 0.55,
      shutterSound: false,
    });
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

  it('explains permissions before prompting and recovers from denial through settings', async () => {
    const native = services();
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

    expect(screen.getByText(/No additional location permission/i)).toBeTruthy();
    expect(native.requestCameraPermission).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText('Start capture')));
    await waitFor(() => screen.getByText('Camera access unavailable'));
    expect(
      screen.getByText(/Enable camera access in system settings/i),
    ).toBeTruthy();
    expect(screen.queryByText('Import')).toBeNull();
    expect(screen.queryByText(/Suggested 25% overlap/i)).toBeNull();
    expect(screen.queryByText('Az −5°')).toBeNull();
    expect(screen.queryByText('Az +5°')).toBeNull();
    expect(screen.getByLabelText('Current camera footprint')).toBeTruthy();
    expect(
      screen.getByText(/55° × 69° camera FOV · metadata-derived estimate/i),
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

    fireEvent.press(screen.getByText('Open settings'));
    expect(native.openSettings).toHaveBeenCalledTimes(1);
  });

  it('uses the rear camera at 1x and saves the ready pose captured at shutter time', async () => {
    mockCaptureAltitudeDegrees = 0;
    const native = {
      ...services(),
      requestCameraPermission: jest.fn().mockResolvedValue(true),
      takePicture: jest.fn().mockResolvedValue({
        uri: 'temp://capture.jpg',
        widthPixels: 1600,
        heightPixels: 1200,
        fileExtension: 'jpg',
      }),
    };
    const controller: PanoramaCaptureController = {
      load: jest.fn().mockResolvedValue({
        profile,
        profileName: 'Bedroom window',
        activePanorama: null,
        draft: null,
      }),
      createDraft: jest.fn().mockResolvedValue(emptyDraft),
      addTile: jest.fn().mockResolvedValue(emptyDraft),
      updateTilePlacement: jest.fn(),
      discardDraft: jest.fn(),
      completeDraft: jest.fn(),
    };
    const screen = await renderScreen(controller, native);
    await waitFor(() => screen.getByText('Capture surroundings'));
    await act(async () => fireEvent.press(screen.getByText('Start capture')));
    await waitFor(() => screen.getByText('0 captured'));

    expect(
      screen.getByLabelText('Rear camera preview at 1x').props,
    ).toMatchObject({
      facing: 'back',
      ratio: '4:3',
      zoom: 0,
    });
    await act(async () => fireEvent.press(screen.getByText('Capture')));
    await waitFor(() => expect(controller.addTile).toHaveBeenCalledTimes(1));
    expect(native.takePicture).toHaveBeenCalledTimes(1);
    expect(controller.addTile).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({
        sourceKind: 'camera',
        reviewedPlacement: expect.objectContaining({
          centerAltitudeDegrees: 0,
          horizontalFieldOfViewDegrees: 55,
          verticalFieldOfViewDegrees: 69,
        }),
      }),
    );
  });

  it.each([
    ['stabilizing', /Hold the phone steady/i],
    ['stale', /Direction update paused/i],
    ['unreliable', /Direction is unreliable/i],
  ])(
    'blocks capture while pose readiness is %s',
    async (readiness, message) => {
      mockPoseReadiness = readiness;
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
      await waitFor(() => screen.getByText(message));

      expect(
        screen.getByRole('button', { name: 'Capture' }).props
          .accessibilityState,
      ).toEqual({ disabled: true });
      fireEvent.press(screen.getByRole('button', { name: 'Capture' }));
      expect(native.takePicture).not.toHaveBeenCalled();
    },
  );

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
            ...capturedTile,
            reviewedPlacement: {
              ...capturedTile.reviewedPlacement,
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

  it.each([[-1, /center of the camera.*horizon/i]])(
    'blocks camera capture below the horizon at %i degrees',
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
      expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
    },
  );
});
