import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import { selectedTrajectoryCache } from '../astronomy/obstructionVisibility';
import type { ObservingWindow } from '../astronomy/localCivilTime';
import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import type { ProfileRecord } from '../storage/profileRepository';
import {
  TargetListScreen,
  type TargetListController,
  type TargetListNavigation,
} from './TargetListScreen';

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

const window: ObservingWindow = {
  kind: 'custom',
  startTimestampUtc: '2026-08-19T19:00:00.000Z',
  endTimestampUtc: '2026-08-20T03:00:00.000Z',
  note: null,
  warnings: [],
};

const target: CatalogueTarget = {
  id: 'NGC0224',
  preferredName: 'Andromeda Galaxy',
  aliases: ['M 31', 'NGC 224'],
  rightAscensionJ2000Hours: 0.712,
  declinationJ2000Degrees: 41.269,
  constellation: 'And',
  objectType: 'Galaxy',
  majorAxisArcminutes: 190,
  minorAxisArcminutes: 60,
  magnitude: 3.4,
  memberships: { messier: [31], ngc: ['NGC 224'], ic: [] },
  prominenceTier: 1,
};

const trajectory: SelectedTargetTrajectory = {
  samples: [],
  markers: [],
  aboveHorizonIntervals: [
    {
      startTimestampUtc: '2026-08-19T19:00:00.000Z',
      endTimestampUtc: '2026-08-20T03:00:00.000Z',
      durationMilliseconds: 8 * 60 * 60 * 1000,
    },
  ],
  visibilityIntervals: [
    {
      startTimestampUtc: '2026-08-19T19:14:00.000Z',
      endTimestampUtc: '2026-08-19T22:10:00.000Z',
      durationMilliseconds: 176 * 60 * 1000,
    },
    {
      startTimestampUtc: '2026-08-19T23:10:00.000Z',
      endTimestampUtc: '2026-08-20T02:12:00.000Z',
      durationMilliseconds: 182 * 60 * 1000,
    },
  ],
  blockedIntervals: [],
  transitions: [],
  totalAboveHorizonMilliseconds: 8 * 60 * 60 * 1000,
  totalVisibleMilliseconds: 358 * 60 * 1000,
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

const controller = (hasMask: boolean): TargetListController => ({
  load: jest.fn().mockResolvedValue({
    equipment: null,
    maskRevision: hasMask
      ? {
          id: 'mask-1',
          profileId: profile.id,
          panoramaRevisionId: 'panorama-1',
          formatVersion: 1,
          createdAtUtc: '2026-08-19T12:00:00.000Z',
          coveragePolygons: [],
          operations: [],
        }
      : null,
    panoramaRevisionId: hasMask ? 'panorama-1' : null,
    profile,
    targets: [target],
    window,
  }),
});

const navigation = (): TargetListNavigation => ({
  goBack: jest.fn(),
  selectTarget: jest.fn(),
});

describe('TargetListScreen', () => {
  beforeEach(() => selectedTrajectoryCache.clear());

  it('renders progressive ranked results with every visible interval and selects back to Sky View', async () => {
    const targetNavigation = navigation();
    const screen = await renderWithSafeArea(
      <TargetListScreen
        calculateVisibility={async () => trajectory}
        controller={controller(true)}
        navigation={targetNavigation}
        profileId={profile.id}
        requestedWindow={window}
      />,
    );

    await waitFor(() => screen.getByText('Andromeda Galaxy'));
    expect(screen.getByText('Total visible: 5h 58m')).toBeTruthy();
    expect(screen.getByText(/22:14–01:10/)).toBeTruthy();
    expect(screen.getByText(/02:10–05:12/)).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText('Inspect Andromeda Galaxy in Sky View'),
    );
    expect(targetNavigation.selectTarget).toHaveBeenCalledWith(
      profile.id,
      target.id,
      window,
    );
  });

  it('uses truthful above-horizon wording when no completed mask exists', async () => {
    const screen = await renderWithSafeArea(
      <TargetListScreen
        calculateVisibility={async () => ({
          ...trajectory,
          visibilityIntervals: [],
          totalVisibleMilliseconds: 0,
        })}
        controller={controller(false)}
        navigation={navigation()}
        profileId={profile.id}
        requestedWindow={window}
      />,
    );

    await waitFor(() => screen.getByText('Andromeda Galaxy'));
    expect(
      screen.getByText('Above horizon: 8h · obstructions not assessed'),
    ).toBeTruthy();
    expect(screen.queryByText(/Total visible/)).toBeNull();
  });

  it('cancels active local calculation without changing profile data', async () => {
    let receivedSignal: AbortSignal | undefined;
    const screen = await renderWithSafeArea(
      <TargetListScreen
        calculateVisibility={async (_input, options) => {
          receivedSignal = options?.signal;
          await new Promise(() => undefined);
          return trajectory;
        }}
        controller={controller(true)}
        navigation={navigation()}
        profileId={profile.id}
        requestedWindow={window}
      />,
    );

    await waitFor(() => expect(receivedSignal).toBeDefined());
    await fireEvent.press(screen.getByText('Cancel calculation'));
    expect(receivedSignal?.aborted).toBe(true);
    expect(screen.getByText('Calculation cancelled')).toBeTruthy();
    expect(screen.getByText('Calculate again')).toBeTruthy();
  });
});
