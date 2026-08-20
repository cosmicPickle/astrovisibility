import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import { VisibilityCalculationCache } from '../astronomy/obstructionVisibility';
import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActiveMaskRevision } from '../storage/maskRepository';
import type { ProfileRecord } from '../storage/profileRepository';
import type { HorizontalCatalogueTarget } from './catalogueViewport';
import {
  SkyViewScreen,
  type SkyRendererProps,
  type SkyViewController,
  type SkyViewNavigation,
} from './SkyViewScreen';

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
  sensorWidthMillimeters: 23.5,
  sensorHeightMillimeters: 15.6,
  pixelSizeMicrometers: 3.76,
  frameRotationDegrees: 0,
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
  objectType: 'HII region',
  majorAxisArcminutes: 65,
  minorAxisArcminutes: 60,
  magnitude: 4,
  memberships: { messier: [42], ngc: ['NGC 1976'], ic: [] },
  prominenceTier: 1,
};

const horizontalTarget: HorizontalCatalogueTarget = {
  altitudeDegrees: 40,
  azimuthDegrees: 180,
  target: catalogueTarget,
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

const renderer = ({ onSelectTarget, targets }: SkyRendererProps) => (
  <View accessibilityLabel="Test sky renderer">
    {targets.map((item) => (
      <Pressable
        accessibilityRole="button"
        key={item.target.id}
        onPress={() => onSelectTarget(item)}
      >
        <Text>{item.target.preferredName}</Text>
      </Pressable>
    ))}
  </View>
);

const rendererWithStageFourOverlays = (props: SkyRendererProps) => (
  <View accessibilityLabel="Test sky renderer">
    <Text testID="trajectory-sample-count">
      {props.trajectory?.samples.length ?? 0}
    </Text>
    <Text testID="trajectory-marker-count">
      {props.trajectory?.markers.length ?? 0}
    </Text>
    <Text testID="field-of-view-equipment">
      {props.fieldOfViewEquipment?.name ?? 'none'}
    </Text>
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
    <Text testID="panorama-tile-count">
      {props.panoramaOverlay?.tiles.length ?? 0}
    </Text>
    <Text testID="panorama-opacity">
      {props.panoramaOverlay?.opacityPercent ?? 0}
    </Text>
    <Text testID="panorama-visible">
      {props.panoramaOverlay?.visible ? 'visible' : 'hidden'}
    </Text>
    <Text testID="mask-operation-count">
      {props.maskOverlay?.mask.operations.length ?? 0}
    </Text>
    <Text testID="mask-opacity">{props.maskOverlay?.opacityPercent ?? 0}</Text>
    <Text testID="mask-visible">
      {props.maskOverlay?.visible ? 'visible' : 'hidden'}
    </Text>
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
      projectedTargets: [horizontalTarget],
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
          projectedTargets: [horizontalTarget],
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
    expect(screen.getByText('No imaging setup')).toBeTruthy();
    expect(screen.getByText('Orion Nebula')).toBeTruthy();
    expect(screen.queryByText(/visible until/i)).toBeNull();
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
    expect(
      screen.getByText('Above horizon; obstructions not assessed'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('More Info'));
    expect(screen.getByText('Right ascension (J2000)')).toBeTruthy();
    expect(screen.getByText('5.588 h')).toBeTruthy();
    expect(screen.getByText('-5.391°')).toBeTruthy();
  });

  it('changes the selected equipment and persists it for the profile', async () => {
    const secondEquipment = {
      ...equipment,
      id: 'equipment-2',
      name: 'Long-focus reflector',
    };
    const skyController = controller({
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
    await fireEvent.press(screen.getByText(equipment.name));
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
    expect(screen.getByText('Tonight')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close time sheet'));
    await fireEvent.press(screen.getByLabelText('Profile menu'));
    await fireEvent.press(screen.getByText('Capture panorama'));
    expect(skyNavigation.openPanoramaCapture).toHaveBeenCalledWith(profile.id);
    await fireEvent.press(screen.getByLabelText('Profile menu'));
    await fireEvent.press(screen.getByText('Edit profile'));
    expect(skyNavigation.editProfile).toHaveBeenCalledWith(profile.id);
    await fireEvent.press(screen.getByText('View All Targets'));
    expect(skyNavigation.openTargetList).toHaveBeenCalledWith(
      profile.id,
      expect.objectContaining({
        startTimestampUtc: expect.any(String),
        endTimestampUtc: expect.any(String),
      }),
    );
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

  it('renders a saved panorama with independent visibility and adjustable opacity', async () => {
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({ panorama })}
        navigation={navigation()}
        profileId={profile.id}
        renderSky={rendererWithPanorama}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    expect(screen.getByTestId('panorama-tile-count').props.children).toBe(1);
    expect(screen.getByTestId('panorama-opacity').props.children).toBe(55);
    expect(screen.getByTestId('panorama-visible').props.children).toBe(
      'visible',
    );

    await fireEvent.press(screen.getByText('Panorama 55%'));
    expect(screen.getByText('Panorama overlay')).toBeTruthy();
    await fireEvent.press(screen.getByText('Hide panorama'));
    expect(screen.getByTestId('panorama-visible').props.children).toBe(
      'hidden',
    );
    fireEvent(
      screen.getByLabelText('Panorama opacity'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'increment' },
      },
    );
    await waitFor(() =>
      expect(screen.getByTestId('panorama-opacity').props.children).toBe(60),
    );
  });

  it('renders and controls a completed mask independently from its panorama', async () => {
    const screen = await renderWithSafeArea(
      <SkyViewScreen
        controller={controller({ hasMask: true, mask, panorama })}
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

    await fireEvent.press(screen.getByText('Mask 60%'));
    await fireEvent.press(screen.getByText('Hide mask'));
    expect(screen.getByTestId('mask-visible').props.children).toBe('hidden');
    fireEvent(screen.getByLabelText('Mask opacity'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
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
      Number(screen.getByTestId('trajectory-marker-count').props.children),
    ).toBeGreaterThan(1);
    expect(screen.getByTestId('field-of-view-equipment').props.children).toBe(
      equipment.name,
    );
    expect(
      screen.getByText('Above horizon; obstructions not assessed'),
    ).toBeTruthy();
    expect(screen.queryByText(/visible until/i)).toBeNull();
  });

  it('shows mask-derived visible intervals and transition truth after calculation', async () => {
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

    await waitFor(() =>
      screen.getByText('5m visible through local obstructions'),
    );
    expect(screen.getByText('Visible until 23:05')).toBeTruthy();
    expect(
      String(screen.getByTestId('trajectory-assessments').props.children),
    ).toContain('visible');
    expect(
      String(screen.getByTestId('trajectory-assessments').props.children),
    ).toContain('blocked');
    expect(
      screen.getByTestId('trajectory-transition-count').props.children,
    ).toBe(1);
    expect(
      screen.queryByText('Above horizon; obstructions not assessed'),
    ).toBeNull();
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

  it('does not recalculate when panorama opacity changes', async () => {
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

    await fireEvent.press(screen.getByText('Panorama 55%'));
    fireEvent(
      screen.getByLabelText('Panorama opacity'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'increment' },
      },
    );
    await waitFor(() => screen.getByText('Panorama 60%'));
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

  it('applies a custom cross-midnight window and reprojects the sky at its start', async () => {
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
    await fireEvent.press(screen.getByText('Custom interval'));
    await fireEvent.changeText(
      screen.getByLabelText('Start date'),
      '2026-08-19',
    );
    await fireEvent.changeText(screen.getByLabelText('Start time'), '22:00');
    await fireEvent.changeText(screen.getByLabelText('End date'), '2026-08-20');
    await fireEvent.changeText(screen.getByLabelText('End time'), '02:30');
    await fireEvent.press(screen.getByText('Apply interval'));

    await waitFor(() =>
      expect(skyController.load).toHaveBeenLastCalledWith(
        profile.id,
        '2026-08-19T19:00:00.000Z',
      ),
    );
  });
});
