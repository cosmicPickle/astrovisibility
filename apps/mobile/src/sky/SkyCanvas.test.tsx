import { render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import {
  getPlanetariumCameraCenter,
  type PlanetariumCamera,
} from './planetariumProjection';
import { SkyCanvas } from './SkyCanvas';

const mockObservedCameras: PlanetariumCamera[] = [];

jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: PropsWithChildren) => children,
}));

jest.mock('./PlanetariumScene', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const reactNative = jest.requireActual('react-native');
  return {
    PlanetariumScene: () =>
      react.createElement(reactNative.View, { testID: 'planetarium-scene' }),
  };
});

jest.mock('./usePlanetariumNavigation', () => ({
  usePlanetariumNavigation: ({
    cameraState,
  }: {
    cameraState: PlanetariumCamera;
  }) => {
    mockObservedCameras.push(cameraState);
    return {
      camera: {
        get: () => cameraState,
        set: jest.fn(),
        value: cameraState,
      },
      gesture: {},
    };
  },
}));

const trajectory: SelectedTargetTrajectory = {
  samples: [
    {
      assessment: 'unassessed',
      azimuthDegreesClockwiseFromNorth: 330,
      refractedAltitudeDegrees: 55,
      timestampUtc: '2026-08-20T20:00:00.000Z',
      unwrappedAzimuthDegrees: 330,
    },
    {
      assessment: 'unassessed',
      azimuthDegreesClockwiseFromNorth: 10,
      refractedAltitudeDegrees: 60,
      timestampUtc: '2026-08-21T02:00:00.000Z',
      unwrappedAzimuthDegrees: 370,
    },
  ],
  markers: [],
  aboveHorizonIntervals: [],
  visibilityIntervals: [],
  blockedIntervals: [],
  transitions: [],
  totalAboveHorizonMilliseconds: 21_600_000,
  totalVisibleMilliseconds: 0,
};

const commonProps = {
  celestialEquatorDirections: [],
  fieldOfViewEquipment: null,
  maskOverlay: null,
  observerLatitudeDegrees: 42.7,
  onInspectTrajectoryMarker: jest.fn(),
  onSelectTarget: jest.fn(),
  panoramaOverlay: null,
  targets: [],
};

describe('SkyCanvas selection camera stability', () => {
  beforeEach(() => {
    mockObservedCameras.length = 0;
  });

  it('never moves or zooms the camera when selection and trajectory state change', async () => {
    const view = await render(
      <SkyCanvas
        {...commonProps}
        selectedDirection={null}
        selectedTargetId={null}
        trajectory={null}
      />,
    );
    const initialCamera = mockObservedCameras.at(-1)!;

    await view.rerender(
      <SkyCanvas
        {...commonProps}
        selectedDirection={{ altitudeDegrees: 55, azimuthDegrees: 330 }}
        selectedTargetId="IC1396"
        trajectory={null}
      />,
    );
    await view.rerender(
      <SkyCanvas
        {...commonProps}
        selectedDirection={{ altitudeDegrees: 55, azimuthDegrees: 330 }}
        selectedTargetId="IC1396"
        trajectory={trajectory}
      />,
    );
    await view.rerender(
      <SkyCanvas
        {...commonProps}
        selectedDirection={null}
        selectedTargetId={null}
        trajectory={null}
      />,
    );

    const expectedCenter = getPlanetariumCameraCenter(initialCamera);
    for (const camera of mockObservedCameras) {
      expect(getPlanetariumCameraCenter(camera)).toEqual(expectedCenter);
      expect(camera.fieldOfViewDegrees).toBe(initialCamera.fieldOfViewDegrees);
      expect(camera.forward).toEqual(initialCamera.forward);
      expect(camera.right).toEqual(initialCamera.right);
      expect(camera.up).toEqual(initialCamera.up);
    }
  });
});
