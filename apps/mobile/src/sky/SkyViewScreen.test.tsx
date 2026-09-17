import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert, PanResponder, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import {
  selectedTrajectoryCache,
  createVisibilityCalculationTargetKey,
  VisibilityCalculationCache,
} from '../astronomy/obstructionVisibility';
import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActiveMaskRevision } from '../storage/maskRepository';
import type { ProfileRecord } from '../storage/profileRepository';
import type { VisibilityCalculationCacheRepository } from '../storage/visibilityCalculationCacheRepository';
import {
  resetTargetDiscoveryStateForTests,
  setTargetDiscoveryFilterInput,
  setTargetDiscoverySearchText,
} from '../targets/targetDiscoveryState';
import {
  SkyViewScreen,
  type SkyRendererProps,
  type SkyViewController,
  type SkyViewNavigation,
} from './SkyViewScreen';

jest.mock('reanimated-color-picker', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const reactNative = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      react.createElement(reactNative.View, null, children),
    HueSlider: () => react.createElement(reactNative.View),
    Panel1: () => react.createElement(reactNative.View),
    Preview: () => react.createElement(reactNative.View),
  };
});

const profile: ProfileRecord = {
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

const equipment: EquipmentRecord = {
  id: 'equipment-1',
  name: 'Wide-field refractor',
  focalLengthMillimeters: 400,
  apertureMillimeters: 80,
  sensorWidthPixels: 6250,
  sensorHeightPixels: 4149,
  pixelSizeMicrometers: 3.76,
  createdAtUtc: '2026-08-19T12:00:00.000Z',
  updatedAtUtc: '2026-08-19T12:00:00.000Z',
};

const catalogueTarget: CatalogueTarget = {
  id: 'NGC1976',
  preferredName: 'Orion Nebula',
  aliases: ['M 42', 'NGC 1976'],
  rightAscensionJ2000Hours: 5.588,
  declinationJ2000Degrees: -5.391,
  constellation: 'Ori',
  objectType: 'HII',
  majorAxisArcminutes: 65,
  minorAxisArcminutes: 60,
  magnitude: 4,
  memberships: { messier: [42], ngc: ['NGC 1976'], ic: [] },
  prominenceTier: 1,
};

const panorama = {
  id: 'panorama-1',
  profileId: profile.id,
  tiles: [
    {
      id: 'tile-1',
      uri: 'file:///panorama/tile-1.jpg',
      centerAzimuthDegrees: 180,
      centerAltitudeDegrees: 35,
      rollDegrees: 0,
      horizontalFieldOfViewDegrees: 60,
      verticalFieldOfViewDegrees: 45,
      widthPixels: 1600,
      heightPixels: 1200,
      coveragePolygon: [
        { azimuthDegrees: 150, altitudeDegrees: 10 },
        { azimuthDegrees: 210, altitudeDegrees: 10 },
        { azimuthDegrees: 210, altitudeDegrees: 60 },
      ],
    },
  ],
};

const mask: ActiveMaskRevision = {
  id: 'mask-1',
  profileId: profile.id,
  panoramaRevisionId: panorama.id,
  formatVersion: 1,
  createdAtUtc: '2026-08-19T20:00:00.000Z',
  coveragePolygons: [
    [
      { azimuthDegrees: 150, altitudeDegrees: 12 },
      { azimuthDegrees: 210, altitudeDegrees: 12 },
      { azimuthDegrees: 210, altitudeDegrees: 58 },
      { azimuthDegrees: 150, altitudeDegrees: 58 },
    ],
  ],
  operations: [
    {
      id: 'visible-region',
      kind: 'visiblePolygon',
      points: [
        { azimuthDegrees: 160, altitudeDegrees: 20 },
        { azimuthDegrees: 200, altitudeDegrees: 20 },
        { azimuthDegrees: 180, altitudeDegrees: 50 },
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

const renderer = (props: SkyRendererProps) => (
  <View accessibilityLabel="Test sky renderer">
    <Text testID="field-of-view-orientation">
      {props.fieldOfViewRotationDegrees}
    </Text>
    <Text testID="minimum-target-count">{props.minimumTargetCount}</Text>
    <Text testID="constellation-opacity">
      {props.constellationOpacityPercent}
    </Text>
    <Text testID="registered-dso-image-count">
      {props.registeredCelestialDsoImages.length}
    </Text>
    {props.targets.map((item) => (
      <Pressable
        accessibilityRole="button"
        key={item.target.id}
        onPress={() => props.onSelectTarget(item)}
      >
        <Text>{item.target.preferredName}</Text>
      </Pressable>
    ))}
  </View>
);

const rendererWithStageFourOverlays = (props: SkyRendererProps) => (
  <View accessibilityLabel="Test sky renderer">
    <Text testID="diurnal-orbit-sample-count">
      {props.diurnalOrbit?.samples.length ?? 0}
    </Text>
    <Text testID="trajectory-sample-count">
      {props.trajectory?.samples.length ?? 0}
    </Text>
    <Text testID="trajectory-marker-count">
      {props.trajectory?.markers.length ?? 0}
    </Text>
    <Text testID="field-of-view-equipment">
      {props.fieldOfViewEquipment?.name ?? 'none'}
    </Text>
    <Text testID="focus-request-id">{props.focusRequest?.id ?? 0}</Text>
    <Text testID="trajectory-assessments">
      {props.trajectory?.samples
        .map(({ assessment }) => assessment)
        .join(',') ?? 'none'}
    </Text>
    <Text testID="trajectory-transition-count">
      {props.trajectory?.transitions.length ?? 0}
    </Text>
    {props.targets.map((item) => (
      <Pressable
        accessibilityRole="button"
        key={item.target.id}
        onPress={() => props.onSelectTarget(item)}
      >
        <Text>{item.target.preferredName}</Text>
      </Pressable>
    ))}
  </View>
);

const obstructionAwareTrajectory: SelectedTargetTrajectory = {
  samples: [
    {
      assessment: 'visible',
      azimuthDegreesClockwiseFromNorth: 180,
      refractedAltitudeDegrees: 40,
      timestampUtc: '2026-08-19T20:00:00.000Z',
      unwrappedAzimuthDegrees: 180,
    },
    {
      assessment: 'blocked',
      azimuthDegreesClockwiseFromNorth: 185,
      refractedAltitudeDegrees: 41,
      timestampUtc: '2026-08-19T20:05:00.000Z',
      unwrappedAzimuthDegrees: 185,
    },
  ],
  markers: [],
  aboveHorizonIntervals: [
    {
      startTimestampUtc: '2026-08-19T20:00:00.000Z',
      endTimestampUtc: '2026-08-19T20:10:00.000Z',
      durationMilliseconds: 10 * 60 * 1000,
    },
  ],
  visibilityIntervals: [
    {
      startTimestampUtc: '2026-08-19T20:00:00.000Z',
      endTimestampUtc: '2026-08-19T20:05:00.000Z',
      durationMilliseconds: 5 * 60 * 1000,
    },
  ],
  blockedIntervals: [
    {
      startTimestampUtc: '2026-08-19T20:05:00.000Z',
      endTimestampUtc: '2026-08-19T20:10:00.000Z',
      durationMilliseconds: 5 * 60 * 1000,
    },
  ],
  transitions: [
    {
      azimuthDegreesClockwiseFromNorth: 185,
      refractedAltitudeDegrees: 41,
      timestampUtc: '2026-08-19T20:05:00.000Z',
      localTimeLabel: '23:05',
      displayLabel: 'Visible until 23:05',
      kind: 'becameBlocked',
    },
  ],
  totalAboveHorizonMilliseconds: 10 * 60 * 1000,
  totalVisibleMilliseconds: 5 * 60 * 1000,
};

const rendererWithPanorama = (props: SkyRendererProps) => (
  <View>
    <Text testID="panorama-overlay-present">
      {props.maskPresentation ? 'present' : 'absent'}
    </Text>
    <Text testID="panorama-tile-count">
      {props.maskPresentation?.panorama?.tiles.length ?? 0}
    </Text>
    <Text testID="panorama-opacity">
      {props.maskPresentation?.opacityPercent ?? 0}
    </Text>
    <Text testID="panorama-visible">
      {props.maskPresentation?.mode === 'panorama' ? 'visible' : 'hidden'}
    </Text>
    <Text testID="mask-operation-count">
      {props.maskPresentation?.mask.operations.length ?? 0}
    </Text>
    <Text testID="mask-overlay-present">
      {props.maskPresentation ? 'present' : 'absent'}
    </Text>
    <Text testID="mask-opacity">
      {props.maskPresentation?.opacityPercent ?? 0}
    </Text>
    <Text testID="mask-visible">
      {props.maskPresentation ? 'visible' : 'hidden'}
    </Text>
    <Text testID="mask-mode">{props.maskPresentation?.mode ?? 'none'}</Text>
    <Text testID="mask-color">{props.maskPresentation?.color ?? 'none'}</Text>
  </View>
);

function controller(
  overrides: Partial<Awaited<ReturnType<SkyViewController['load']>>> = {},
): SkyViewController {
  return {
    load: jest.fn().mockResolvedValue({
      catalogueTargets: [catalogueTarget],
      equipment: [],
      hasMask: false,
      mask: null,
      panorama: null,
      profile,
      selectedEquipmentId: null,
      timestampUtc: '2026-08-19T20:00:00.000Z',
      ...overrides,
    }),
    deletePanoramaAndMask: jest.fn().mockResolvedValue(undefined),
    selectEquipment: jest.fn().mockResolvedValue(undefined),
  };
}

function navigation(): SkyViewNavigation {
  return {
    editProfile: jest.fn(),
    goBack: jest.fn(),
    openLicences: jest.fn(),
    openMaskEditor: jest.fn(),
    openPanoramaCapture: jest.fn(),
    openTargetList: jest.fn(),
  };
}

describe('SkyViewScreen', () => {
  beforeEach(() => {
    resetTargetDiscoveryStateForTests();
    selectedTrajectoryCache.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('filters sky targets using cached duration and pixel limits while retaining explicit selection', async () => {
    const other = {
      ...catalogueTarget,
      id: 'other',
      preferredName: 'Other fixture',
    };
    const summary = {
      ...obstructionAwareTrajectory,
      aboveHorizonIntervals: [
        {
          startTimestampUtc: '2026-08-19T20:00:00Z',
          endTimestampUtc: '2026-08-19T21:00:00Z',
          durationMilliseconds: 60 * 60000,
        },
      ],
      totalAboveHorizonMilliseconds: 60 * 60000,
    };
    const cache = {
      activateContext: jest.fn().mockResolvedValue(undefined),
      getSummaries: jest
        .fn()
        .mockResolvedValue(
          new Map(
            [catalogueTarget, other].map((target) => [
              createVisibilityCalculationTargetKey(target),
              summary,
            ]),
          ),
        ),
      putSummaries: jest.fn().mockResolvedValue(undefined),
    } as unknown as VisibilityCalculationCacheRepository;
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({
          catalogueTargets: [catalogueTarget, other],
          equipment: [equipment],
          selectedEquipmentId: equipment.id,
          visibilityCache: cache,
        })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
        initialObservingWindow={{
          kind: 'custom',
          startTimestampUtc: '2026-08-19T19:00:00Z',
          endTimestampUtc: '2026-08-20T03:00:00Z',
          note: null,
          warnings: [],
        }}
        initialSelectedTargetId={catalogueTarget.id}
      />,
    );
    await waitFor(() => screen.getByText('Other fixture'));
    await act(() =>
      setTargetDiscoveryFilterInput(profile.id, 'minDurationMinutes', '61'),
    );
    await waitFor(() => expect(cache.getSummaries).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText(/Calculating duration filter/)).toBeNull(),
    );
    expect(screen.queryByText('Other fixture')).toBeNull();
    expect(screen.getAllByText('Orion Nebula').length).toBeGreaterThan(0);
    await act(() =>
      setTargetDiscoveryFilterInput(profile.id, 'minDurationMinutes', '60'),
    );
    await waitFor(() => screen.getByText('Other fixture'));
    await act(() =>
      setTargetDiscoveryFilterInput(profile.id, 'maxSizePixels', '100'),
    );
    expect(screen.queryByText('Other fixture')).toBeNull();
    expect(screen.getAllByText('Orion Nebula').length).toBeGreaterThan(0);
    expect(cache.getSummaries).toHaveBeenCalledTimes(1);
  });

  it('does not calculate duration filters while another route is active', async () => {
    setTargetDiscoveryFilterInput(profile.id, 'minDurationMinutes', '60');
    const cache = {
      activateContext: jest.fn().mockResolvedValue(undefined),
      getSummaries: jest.fn().mockResolvedValue(new Map()),
      putSummaries: jest.fn().mockResolvedValue(undefined),
    } as unknown as VisibilityCalculationCacheRepository;
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({ visibilityCache: cache })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
        isActive={false}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    expect(cache.getSummaries).not.toHaveBeenCalled();
  });

  it('shows a deliberate loading failure and retries local data', async () => {
    const failedController: SkyViewController = {
      load: jest
        .fn()
        .mockRejectedValueOnce(new Error('read failed'))
        .mockResolvedValueOnce({
          catalogueTargets: [catalogueTarget],
          equipment: [],
          hasMask: false,
          mask: null,
          panorama: null,
          profile,
          selectedEquipmentId: null,
          timestampUtc: '2026-08-19T20:00:00.000Z',
        }),
      selectEquipment: jest.fn(),
      deletePanoramaAndMask: jest.fn(),
    };
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={failedController}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );
    await waitFor(() => screen.getByText('Sky View unavailable'));
    await fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => screen.getByText(profile.name));
    expect(failedController.load).toHaveBeenCalledTimes(2);
  });

  it('remains truthful and useful without a mask or equipment', async () => {
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller()}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    expect(screen.getByText('Local visibility not assessed')).toBeTruthy();
    expect(
      screen.getByText(/suitable above horizon · unassessed/),
    ).toBeTruthy();
    expect(screen.queryByText('No imaging setup')).toBeNull();
    expect(
      screen.getByTestId('registered-dso-image-count').props.children,
    ).toBe(289);
    await fireEvent.press(screen.getByLabelText('View options'));
    expect(screen.queryByText('Imaging setup · None')).toBeNull();
    await fireEvent.press(screen.getByText('Constellation opacity · 30%'));
    await fireEvent(
      screen.getByLabelText('Constellation opacity'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );
    await waitFor(() =>
      expect(screen.getByTestId('constellation-opacity').props.children).toBe(
        35,
      ),
    );
    await fireEvent.press(
      screen.getByLabelText('Close constellation controls'),
    );
    await fireEvent.press(screen.getByLabelText('Close view options'));
    await fireEvent.press(screen.getByLabelText('Optics'));
    expect(screen.getByText('None')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close optics menu'));
    expect(screen.getByText('Orion Nebula')).toBeTruthy();
    expect(screen.queryByText(/visible until/i)).toBeNull();
  });

  it('shares debounced name search and category filters with target discovery', async () => {
    const galaxy: CatalogueTarget = {
      ...catalogueTarget,
      id: 'NGC0224',
      preferredName: 'Andromeda Galaxy',
      aliases: ['M 31', 'Andromeda'],
      objectType: 'G',
      memberships: { messier: [31], ngc: ['NGC 224'], ic: [] },
    };
    setTargetDiscoverySearchText(profile.id, 'Andromeda');
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({
          catalogueTargets: [catalogueTarget, galaxy],
        })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );

    await waitFor(() => screen.getByText('Andromeda Galaxy'));
    expect(screen.queryByText('Orion Nebula')).toBeNull();
    await fireEvent.press(screen.getByLabelText('View options'));
    expect(screen.getByDisplayValue('Andromeda')).toBeTruthy();
    await fireEvent.changeText(
      screen.getByPlaceholderText('Search catalogue or name'),
      '',
    );
    await waitFor(() => screen.getByText('Orion Nebula'));
    await fireEvent.press(screen.getByLabelText('Toggle Nebula filter'));
    await waitFor(() => expect(screen.queryByText('Orion Nebula')).toBeNull());
    expect(screen.getByText('Andromeda Galaxy')).toBeTruthy();
  });

  it('does not project search-only objects unless selected and removes them on deselect', async () => {
    const star: CatalogueTarget = {
      ...catalogueTarget,
      id: 'HD000358',
      preferredName: 'Alpha Andromedae',
      aliases: ['Sirrah', 'HD 358'],
      objectType: '*',
      majorAxisArcminutes: undefined,
      minorAxisArcminutes: undefined,
      memberships: { messier: [], ngc: [], ic: [] },
    };
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({
          catalogueTargets: [catalogueTarget, star],
        })}
        initialSelectedTargetId={star.id}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );

    await waitFor(() => screen.getByLabelText('Close selected target'));
    await fireEvent.press(screen.getByLabelText('Close selected target'));
    await waitFor(() =>
      expect(screen.queryByText('Alpha Andromedae')).toBeNull(),
    );
    expect(screen.getByText('Orion Nebula')).toBeTruthy();
  });

  it('filters the atlas for the selected optics before rendering targets', async () => {
    const tinyGalaxy: CatalogueTarget = {
      ...catalogueTarget,
      id: 'NGC9999',
      preferredName: 'Tiny Galaxy',
      aliases: ['NGC 9999'],
      objectType: 'G',
      majorAxisArcminutes: 0.05,
      minorAxisArcminutes: 0.03,
      memberships: { messier: [], ngc: ['NGC 9999'], ic: [] },
    };
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({
          catalogueTargets: [catalogueTarget, tinyGalaxy],
          equipment: [equipment],
          selectedEquipmentId: equipment.id,
        })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );

    await waitFor(() => screen.getByText('Orion Nebula'));
    expect(screen.queryByText('Tiny Galaxy')).toBeNull();
  });

  it('selects one target and expands its available catalogue information', async () => {
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller()}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByText('Orion Nebula'));
    expect(screen.getByText('M 42 · NGC 1976')).toBeTruthy();
    await waitFor(() => screen.getByText('Obstructions not assessed'));
    await fireEvent.press(
      screen.getByLabelText('More information about Orion Nebula'),
    );
    expect(screen.getByText('Right ascension (J2000)')).toBeTruthy();
    expect(screen.getByText('5.588 h')).toBeTruthy();
    expect(screen.getByText('-5.391°')).toBeTruthy();
  });

  it('changes the selected equipment and persists it for the profile', async () => {
    const secondEquipment = {
      ...equipment,
      id: 'equipment-2',
      name: 'Long-focus reflector',
      focalLengthMillimeters: 800,
    };
    const compactGalaxy: CatalogueTarget = {
      ...catalogueTarget,
      aliases: ['NGC 9999'],
      id: 'NGC9999',
      majorAxisArcminutes: 1,
      minorAxisArcminutes: 1,
      memberships: { messier: [], ngc: ['NGC 9999'], ic: [] },
      objectType: 'G',
      preferredName: 'Compact Galaxy',
    };
    const skyController = controller({
      catalogueTargets: [catalogueTarget, compactGalaxy],
      equipment: [equipment, secondEquipment],
      selectedEquipmentId: equipment.id,
    });
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={skyController}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    expect(screen.queryByText(compactGalaxy.preferredName)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Optics'));
    expect(screen.getByText('Current optics profile')).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText('Choose current optics profile'),
    );
    await fireEvent.press(
      screen.getByLabelText(`Use ${secondEquipment.name} imaging setup`),
    );
    await waitFor(() =>
      expect(skyController.selectEquipment).toHaveBeenCalledWith(
        profile.id,
        secondEquipment.id,
      ),
    );
    expect(screen.getByText(secondEquipment.name)).toBeTruthy();
    expect(screen.getByText(compactGalaxy.preferredName)).toBeTruthy();
    await fireEvent.press(screen.getByText('Orientation · 0°'));
    await fireEvent(
      screen.getByLabelText('Field of view orientation'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );
    expect(screen.getByTestId('field-of-view-orientation').props.children).toBe(
      5,
    );
  });

  it('commits the View Options target floor only when the slider is released', async () => {
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller()}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    expect(screen.getByTestId('minimum-target-count').props.children).toBe(100);

    await fireEvent.press(screen.getByLabelText('View options'));
    const slider = screen.getByLabelText('Minimum atlas targets');
    await fireEvent(slider, 'layout', {
      nativeEvent: { layout: { height: 44, width: 190, x: 0, y: 0 } },
    });
    await fireEvent(slider, 'responderMove', {
      nativeEvent: { locationX: 190 },
    });
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByTestId('minimum-target-count').props.children).toBe(100);

    await fireEvent(slider, 'responderRelease', {
      nativeEvent: { locationX: 190 },
    });
    expect(screen.getByTestId('minimum-target-count').props.children).toBe(200);
  });

  it('wires the compact time, profile menu, and target-list affordances', async () => {
    const skyNavigation = navigation();
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller()}
        navigation={skyNavigation}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByLabelText('Sky time'));
    expect(screen.getByText('Observing window')).toBeTruthy();
    expect(screen.getByLabelText('Show shooting conditions')).toBeTruthy();
    expect(screen.queryByText('Tonight')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Close time sheet'));
    await fireEvent.press(screen.getByLabelText('Profile menu'));
    await fireEvent.press(screen.getByText('Capture panorama'));
    expect(skyNavigation.openPanoramaCapture).toHaveBeenCalledWith(profile.id);
    await fireEvent.press(screen.getByLabelText('Profile menu'));
    await fireEvent.press(screen.getByText('Edit profile'));
    expect(skyNavigation.editProfile).toHaveBeenCalledWith(profile.id);
    await fireEvent.press(screen.getByLabelText('View all targets'));
    expect(skyNavigation.openTargetList).toHaveBeenCalledWith(
      profile.id,
      expect.objectContaining({
        startTimestampUtc: expect.any(String),
        endTimestampUtc: expect.any(String),
      }),
    );
  });

  it('defers React control refreshes until live time movement pauses', async () => {
    const panResponder = jest.spyOn(PanResponder, 'create').mockImplementation(
      (handlers) =>
        ({
          panHandlers: {
            onResponderGrant: handlers.onPanResponderGrant,
            onResponderMove: handlers.onPanResponderMove,
            onResponderRelease: handlers.onPanResponderRelease,
            onResponderTerminate: handlers.onPanResponderTerminate,
          },
        }) as ReturnType<typeof PanResponder.create>,
    );
    const renderSky = jest.fn(renderer);
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller()}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderSky}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByLabelText('Sky time'));
    const slider = screen.getByLabelText('Time of day');
    const initialControlTime =
      renderSky.mock.lastCall![0].controlTimeMilliseconds;

    jest.useFakeTimers();
    await act(async () => {
      slider.props.onLayout({ nativeEvent: { layout: { width: 240 } } });
      slider.props.onResponderGrant({}, { dx: 0 });
      slider.props.onResponderMove({}, { dx: 60 });
    });

    expect(renderSky.mock.lastCall![0].controlTimeMilliseconds).toBe(
      initialControlTime,
    );
    expect(renderSky.mock.lastCall![0].sceneTimeMilliseconds.get()).not.toBe(
      initialControlTime,
    );

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(renderSky.mock.lastCall![0].controlTimeMilliseconds).toBe(
      renderSky.mock.lastCall![0].sceneTimeMilliseconds.get(),
    );
    panResponder.mockRestore();
  });

  it('restores a list-selected target and observing window for trajectory inspection', async () => {
    const selectedWindow = {
      kind: 'custom' as const,
      startTimestampUtc: '2026-08-19T20:00:00.000Z',
      endTimestampUtc: '2026-08-19T21:00:00.000Z',
      note: null,
      warnings: [],
    };
    const skyController = controller();
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        calculateVisibility={async () => obstructionAwareTrajectory}
        controller={skyController}
        initialObservingWindow={selectedWindow}
        initialSelectedTargetId={catalogueTarget.id}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithStageFourOverlays}
      />,
    );

    await waitFor(() => screen.getByText('M 42 · NGC 1976'));
    expect(
      Number(screen.getByTestId('focus-request-id').props.children),
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        Number(screen.getByTestId('trajectory-sample-count').props.children),
      ).toBeGreaterThan(2),
    );
    expect(skyController.load).toHaveBeenCalledWith(
      profile.id,
      selectedWindow.startTimestampUtc,
    );
  });

  it('restores a selected trajectory from persistent profile cache', async () => {
    const persistentCache = {
      activateContext: jest.fn().mockResolvedValue(undefined),
      getTrajectory: jest.fn().mockResolvedValue(obstructionAwareTrajectory),
      putTrajectory: jest.fn().mockResolvedValue(undefined),
    } as unknown as VisibilityCalculationCacheRepository;
    const calculateVisibility = jest
      .fn()
      .mockResolvedValue(obstructionAwareTrajectory);
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        calculateVisibility={calculateVisibility}
        controller={controller({ visibilityCache: persistentCache })}
        initialSelectedTargetId={catalogueTarget.id}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithStageFourOverlays}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('trajectory-transition-count').props.children,
      ).toBe(1),
    );
    expect(persistentCache.activateContext).toHaveBeenCalledTimes(1);
    expect(persistentCache.getTrajectory).toHaveBeenCalledTimes(1);
    expect(calculateVisibility).not.toHaveBeenCalled();
  });

  it('does not place an unmasked panorama over the registered sky', async () => {
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({ panorama })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithPanorama}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    expect(screen.getByTestId('panorama-tile-count').props.children).toBe(0);
    expect(screen.getByTestId('panorama-overlay-present').props.children).toBe(
      'absent',
    );

    await fireEvent.press(screen.getByLabelText('View options'));
    expect(screen.queryByText(/Panorama opacity/)).toBeNull();
    expect(screen.queryByText(/Mask appearance/)).toBeNull();
  });

  it('uses one opacity for panorama and color mask modes', async () => {
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({
          hasMask: true,
          mask,
          panorama,
        })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithPanorama}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    expect(screen.queryByText('Local visibility not assessed')).toBeNull();
    expect(screen.getByTestId('mask-operation-count').props.children).toBe(1);
    expect(screen.getByTestId('mask-opacity').props.children).toBe(60);
    expect(screen.getByTestId('mask-visible').props.children).toBe('visible');
    expect(screen.getByTestId('mask-mode').props.children).toBe('panorama');
    expect(screen.getByTestId('panorama-tile-count').props.children).toBe(1);

    await fireEvent.press(screen.getByLabelText('View options'));
    await fireEvent.press(screen.getByText('Mask appearance · Panorama · 60%'));
    await fireEvent.press(screen.getByText('Color'));
    await waitFor(() =>
      expect(screen.getByTestId('mask-mode').props.children).toBe('color'),
    );
    expect(screen.getByText('Mask color')).toBeTruthy();
    await fireEvent(
      screen.getByLabelText('Mask opacity'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'decrement' },
      },
    );
    await waitFor(() =>
      expect(screen.getByTestId('mask-opacity').props.children).toBe(55),
    );
  });

  it('offers ordered mask editing and explicit panorama-mask recreation from the profile menu', async () => {
    const skyNavigation = navigation();
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({ hasMask: true, mask, panorama })}
        navigation={skyNavigation}
        profileId={profile.id}
        renderSky={rendererWithPanorama}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByLabelText('Profile menu'));
    await fireEvent.press(screen.getByText('Edit visibility mask'));
    expect(skyNavigation.openMaskEditor).toHaveBeenCalledWith(profile.id);
  });

  it('deletes the aligned panorama-mask pair before starting recreation', async () => {
    const skyController = controller({ hasMask: true, mask, panorama });
    const skyNavigation = navigation();
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const destructive = buttons?.find(
          (button) => button.style === 'destructive',
        );
        destructive?.onPress?.();
      });
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={skyController}
        navigation={skyNavigation}
        profileId={profile.id}
        renderSky={rendererWithPanorama}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByLabelText('Profile menu'));
    await fireEvent.press(screen.getByText('Recreate panorama and mask'));
    await waitFor(() =>
      expect(skyController.deletePanoramaAndMask).toHaveBeenCalledWith(
        profile.id,
      ),
    );
    await waitFor(() =>
      expect(skyNavigation.openPanoramaCapture).toHaveBeenCalledWith(
        profile.id,
      ),
    );
    alert.mockRestore();
  });

  it('shows a selected target trajectory and truthful no-mask duration summary', async () => {
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({
          equipment: [equipment],
          selectedEquipmentId: equipment.id,
        })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithStageFourOverlays}
        visibilityCache={new VisibilityCalculationCache()}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByText('Orion Nebula'));

    expect(
      Number(screen.getByTestId('trajectory-sample-count').props.children),
    ).toBeGreaterThan(1);
    expect(
      Number(screen.getByTestId('diurnal-orbit-sample-count').props.children),
    ).toBeGreaterThan(1_400);
    expect(
      Number(screen.getByTestId('trajectory-marker-count').props.children),
    ).toBeGreaterThan(1);
    expect(screen.getByTestId('field-of-view-equipment').props.children).toBe(
      equipment.name,
    );
    await waitFor(() => screen.getByText('Obstructions not assessed'));
    expect(screen.queryByText(/visible until/i)).toBeNull();
  });

  it('shows mask-derived visible intervals and transition truth after calculation', async () => {
    const calculateVisibility = jest
      .fn()
      .mockResolvedValue(obstructionAwareTrajectory);
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        calculateVisibility={calculateVisibility}
        controller={controller({
          equipment: [equipment],
          hasMask: true,
          mask,
          panorama,
          selectedEquipmentId: equipment.id,
        })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithStageFourOverlays}
        visibilityCache={new VisibilityCalculationCache()}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByText('Orion Nebula'));

    await waitFor(() =>
      screen.getByText('5m visible through local obstructions'),
    );
    expect(screen.getByText(/About \d+ px along minor axis/)).toBeTruthy();
    expect(screen.getByText('Visibility: 23:00–23:05')).toBeTruthy();
    expect(screen.queryByText('Visible until 23:05')).toBeNull();
    expect(
      String(screen.getByTestId('trajectory-assessments').props.children),
    ).toContain('visible');
    expect(
      String(screen.getByTestId('trajectory-assessments').props.children),
    ).toContain('blocked');
    expect(
      screen.getByTestId('trajectory-transition-count').props.children,
    ).toBe(1);
    expect(screen.queryByText('Obstructions not assessed')).toBeNull();
  });

  it('keeps the exact base arc visible while mask classification is pending', async () => {
    const calculateVisibility = jest.fn(
      () => new Promise<SelectedTargetTrajectory>(() => undefined),
    );
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        calculateVisibility={calculateVisibility}
        controller={controller({ hasMask: true, mask, panorama })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithStageFourOverlays}
        visibilityCache={new VisibilityCalculationCache()}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByText('Orion Nebula'));
    await waitFor(() => expect(calculateVisibility).toHaveBeenCalledTimes(1));

    expect(
      Number(screen.getByTestId('trajectory-sample-count').props.children),
    ).toBeGreaterThan(1);
    expect(
      String(screen.getByTestId('trajectory-assessments').props.children),
    ).toContain('unassessed');
  });

  it('does not recalculate when mask presentation changes', async () => {
    const calculateVisibility = jest
      .fn()
      .mockResolvedValue(obstructionAwareTrajectory);
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        calculateVisibility={calculateVisibility}
        controller={controller({ hasMask: true, mask, panorama })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithStageFourOverlays}
        visibilityCache={new VisibilityCalculationCache()}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByText('Orion Nebula'));
    await waitFor(() => expect(calculateVisibility).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByLabelText('View options'));
    await fireEvent.press(screen.getByText('Mask appearance · Panorama · 60%'));
    await fireEvent.press(screen.getByText('Color'));
    await fireEvent(
      screen.getByLabelText('Mask opacity'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'increment' },
      },
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText('Mask opacity').props.accessibilityValue.now,
      ).toBe(65),
    );
    await fireEvent.press(screen.getByLabelText('Close mask overlay controls'));
    expect(calculateVisibility).toHaveBeenCalledTimes(1);
  });

  it('cancels an active calculation when the selected view unmounts', async () => {
    let receivedSignal: AbortSignal | undefined;
    const calculateVisibility = jest.fn(
      (_input, options?: { signal?: AbortSignal }) => {
        receivedSignal = options?.signal;
        return new Promise<SelectedTargetTrajectory>(() => undefined);
      },
    );
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        calculateVisibility={calculateVisibility}
        controller={controller({ hasMask: true, mask, panorama })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithStageFourOverlays}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByText('Orion Nebula'));
    await waitFor(() => expect(receivedSignal).toBeDefined());

    screen.unmount();
    await waitFor(() => expect(receivedSignal?.aborted).toBe(true));
  });

  it('updates the atlas from the day slider without reloading local storage', async () => {
    const skyController = controller();
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={skyController}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={renderer}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    await fireEvent.press(screen.getByLabelText('Sky time'));
    expect(screen.queryByText('Custom interval')).toBeNull();
    await fireEvent(
      screen.getByLabelText('Time of day'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'increment' },
      },
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Time of day').props.accessibilityValue.text,
      ).toContain('23:15'),
    );
    expect(skyController.load).toHaveBeenCalledTimes(1);
  });
});
