import { act, render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type {
  HorizontalCatalogueTarget,
  RenderedPlanetariumTarget,
} from './planetariumCatalogue';
import {
  createPlanetariumCamera,
  getPlanetariumCameraCenter,
  type PlanetariumCamera,
} from './planetariumProjection';
import { SkyCanvas } from './SkyCanvas';
import { createCelestialTimeTransform } from '../astronomy/celestialTimeTransform';
import type { SharedValue } from 'react-native-reanimated';
import { observedHorizontalVectorToJ2000 } from '../astronomy/celestialTimeTransform';
import { createCelestialCatalogue } from './celestialCatalogue';
import { horizontalDirectionToVector } from './planetariumProjection';

const mockObservedCameras: PlanetariumCamera[] = [];
const mockObservedSceneTargetIds: string[][] = [];
const mockFocusDirection = jest.fn();
let mockNavigationOptions:
  | {
      cameraState: PlanetariumCamera;
      onCameraCommit: (camera: PlanetariumCamera) => void;
      onCameraPreview?: (camera: PlanetariumCamera) => void;
      onTap: (
        xPixels: number,
        yPixels: number,
        camera: PlanetariumCamera,
      ) => void;
    }
  | undefined;

jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: PropsWithChildren) => children,
}));

jest.mock('./PlanetariumScene', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const reactNative = jest.requireActual('react-native');
  return {
    PlanetariumScene: ({
      targets,
    }: {
      targets: RenderedPlanetariumTarget[];
    }) => {
      mockObservedSceneTargetIds.push(targets.map(({ target }) => target.id));
      return react.createElement(reactNative.View, {
        testID: 'planetarium-scene',
      });
    },
  };
});

jest.mock('./usePlanetariumNavigation', () => ({
  usePlanetariumNavigation: (options: {
    cameraState: PlanetariumCamera;
    onCameraCommit: (camera: PlanetariumCamera) => void;
    onCameraPreview?: (camera: PlanetariumCamera) => void;
    onTap: (
      xPixels: number,
      yPixels: number,
      camera: PlanetariumCamera,
    ) => void;
  }) => {
    mockNavigationOptions = options;
    mockObservedCameras.push(options.cameraState);
    return {
      camera: {
        get: () => options.cameraState,
        set: jest.fn(),
        value: options.cameraState,
      },
      focusDirection: mockFocusDirection,
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
  densityCandidateCount: 0,
  diurnalOrbit: null,
  fieldOfViewEquipment: null,
  fieldOfViewRotationDegrees: 0,
  focusRequest: null,
  maskPresentation: null,
  minimumTargetCount: 100,
  onInspectTrajectoryMarker: jest.fn(),
  onSelectTarget: jest.fn(),
  constellationOpacityPercent: 30,
  celestialTimeTransform: createCelestialTimeTransform({
    observer: {
      elevationMetersAboveMeanSeaLevel: 550,
      latitudeDegreesNorth: 42.7,
      longitudeDegreesEast: 23.3,
    },
    window: {
      startTimestampUtc: '2026-08-20T12:00:00.000Z',
      endTimestampUtc: '2026-08-21T12:00:00.000Z',
    },
  }),
  sceneTimeMilliseconds: {
    value: Date.parse('2026-08-20T20:00:00.000Z'),
  } as SharedValue<number>,
  registeredCelestialSky: {
    atlasMeshes: [],
    constellations: [],
    stars: [],
  },
  registeredCelestialDsoImages: [],
  celestialTargets: [],
  controlTimeMilliseconds: Date.parse('2026-08-20T20:00:00.000Z'),
  targets: [],
};

const createCatalogueTarget = (
  id: string,
  azimuthDegrees: number,
): HorizontalCatalogueTarget => {
  const target: CatalogueTarget = {
    aliases: [id],
    constellation: 'Ori',
    declinationJ2000Degrees: 0,
    id,
    magnitude: 5,
    memberships: { ic: [], messier: [], ngc: [] },
    objectType: 'G',
    positionAngleDegrees: 0,
    preferredName: id,
    prominenceTier: 1,
    rightAscensionJ2000Hours: 0,
  };
  return {
    altitudeDegrees: 35,
    azimuthDegrees,
    target,
  };
};

describe('SkyCanvas selection camera stability', () => {
  beforeEach(() => {
    mockObservedCameras.length = 0;
    mockObservedSceneTargetIds.length = 0;
    mockNavigationOptions = undefined;
    mockFocusDirection.mockClear();
  });

  it('focuses a selected target once without refocusing on later renders', async () => {
    const focusRequest = {
      direction: { altitudeDegrees: 42, azimuthDegrees: 175 },
      id: 1,
    };
    const view = await render(
      <SkyCanvas
        {...commonProps}
        focusRequest={null}
        selectedTargetId={null}
        trajectory={null}
      />,
    );

    await view.rerender(
      <SkyCanvas
        {...commonProps}
        focusRequest={focusRequest}
        selectedTargetId="M42"
        trajectory={null}
      />,
    );
    expect(mockFocusDirection).toHaveBeenCalledTimes(1);
    expect(mockFocusDirection).toHaveBeenCalledWith(focusRequest.direction);

    await view.rerender(
      <SkyCanvas
        {...commonProps}
        focusRequest={focusRequest}
        selectedTargetId="M42"
        trajectory={trajectory}
      />,
    );
    expect(mockFocusDirection).toHaveBeenCalledTimes(1);
  });

  it('never moves or zooms the camera when selection and trajectory state change', async () => {
    const view = await render(
      <SkyCanvas {...commonProps} selectedTargetId={null} trajectory={null} />,
    );
    const initialCamera = mockObservedCameras.at(-1)!;

    await view.rerender(
      <SkyCanvas
        {...commonProps}
        selectedTargetId="IC1396"
        trajectory={null}
      />,
    );
    await view.rerender(
      <SkyCanvas
        {...commonProps}
        selectedTargetId="IC1396"
        trajectory={trajectory}
      />,
    );
    await view.rerender(
      <SkyCanvas {...commonProps} selectedTargetId={null} trajectory={null} />,
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

  it('starts zoomed in toward north in the local-horizontal frame', async () => {
    await render(
      <SkyCanvas {...commonProps} selectedTargetId={null} trajectory={null} />,
    );

    const center = getPlanetariumCameraCenter(mockObservedCameras.at(-1)!);
    expect(center.altitudeDegrees).toBeCloseTo(35, 8);
    expect(center.azimuthDegrees).toBeCloseTo(0, 8);
    expect(mockObservedCameras.at(-1)!.fieldOfViewDegrees).toBe(100);
    expect(mockObservedCameras.at(-1)!.mountFrame.kind).toBe('horizontal');
  });

  it('updates the bounded catalogue during pan preview without moving the committed camera or recreating tap handling', async () => {
    const onSelectTarget = jest.fn();
    const southTarget = createCatalogueTarget('south-target', 180);
    const southJ2000 = observedHorizontalVectorToJ2000(
      horizontalDirectionToVector({
        altitudeDegrees: southTarget.altitudeDegrees,
        azimuthDegrees: southTarget.azimuthDegrees,
      }),
      commonProps.celestialTimeTransform,
      commonProps.controlTimeMilliseconds,
    );
    southTarget.target.rightAscensionJ2000Hours =
      ((Math.atan2(southJ2000.y, southJ2000.x) * 12) / Math.PI + 24) % 24;
    southTarget.target.declinationJ2000Degrees =
      (Math.asin(southJ2000.z) * 180) / Math.PI;
    await render(
      <SkyCanvas
        {...commonProps}
        onSelectTarget={onSelectTarget}
        selectedTargetId={null}
        celestialTargets={createCelestialCatalogue([southTarget.target])}
        targets={[southTarget]}
        trajectory={null}
      />,
    );
    const initialCommittedCamera = mockNavigationOptions!.cameraState;
    const initialTapHandler = mockNavigationOptions!.onTap;
    const southCamera = createPlanetariumCamera({
      centerAltitudeDegrees: 35,
      centerAzimuthDegrees: 180,
      fieldOfViewDegrees: 100,
    });

    expect(mockObservedSceneTargetIds.at(-1)).not.toContain('south-target');
    await act(() => {
      mockNavigationOptions!.onCameraPreview?.(southCamera);
    });

    expect(mockNavigationOptions!.cameraState).toBe(initialCommittedCamera);
    expect(mockNavigationOptions!.onTap).toBe(initialTapHandler);
    expect(mockObservedSceneTargetIds.at(-1)).toContain('south-target');
    await act(() => {
      mockNavigationOptions!.onTap(0.5, 0.5, southCamera);
    });
    expect(onSelectTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ id: 'south-target' }),
      }),
    );
    await act(() => {
      mockNavigationOptions!.onCameraCommit(southCamera);
    });

    expect(mockNavigationOptions!.cameraState).toBe(initialCommittedCamera);
    expect(mockNavigationOptions!.onTap).toBe(initialTapHandler);
    expect(mockObservedSceneTargetIds.at(-1)).toContain('south-target');
    expect(mockObservedSceneTargetIds.at(-1)).toEqual(
      mockObservedSceneTargetIds.at(-2),
    );
  });
});
