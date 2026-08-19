import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DashboardScreen, type DashboardController } from './DashboardScreen';

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

const equipment = [
  {
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
  },
  {
    id: 'equipment-2',
    name: 'Long-focus reflector',
    focalLengthMillimeters: 1200,
    apertureMillimeters: 200,
    sensorWidthMillimeters: 23.5,
    sensorHeightMillimeters: 15.6,
    pixelSizeMicrometers: 3.76,
    frameRotationDegrees: 0,
    createdAtUtc: '2026-08-19T12:01:00.000Z',
    updatedAtUtc: '2026-08-19T12:01:00.000Z',
  },
];

function createController(
  data: Awaited<ReturnType<DashboardController['load']>>,
): DashboardController {
  return {
    load: jest.fn().mockResolvedValue(data),
    selectEquipment: jest.fn().mockResolvedValue(undefined),
    deleteProfile: jest.fn().mockResolvedValue(undefined),
    deleteEquipment: jest.fn().mockResolvedValue(undefined),
  };
}

describe('DashboardScreen', () => {
  it('shows deliberate empty states and creation actions', async () => {
    const controller = createController({
      profiles: [],
      equipment: [],
      selectedEquipmentIdByProfile: {},
    });
    const screen = await render(
      <DashboardScreen
        controller={controller}
        navigation={{
          createEquipment: jest.fn(),
          createProfile: jest.fn(),
          editEquipment: jest.fn(),
          editProfile: jest.fn(),
          openProfile: jest.fn(),
          openLicences: jest.fn(),
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('No observing profiles yet')).toBeTruthy(),
    );
    expect(screen.getByText('No imaging setups yet')).toBeTruthy();
    expect(screen.getByText('New profile')).toBeTruthy();
    expect(screen.getByText('New setup')).toBeTruthy();
  });

  it('changes and remembers a profile equipment selection', async () => {
    const controller = createController({
      profiles: [profile],
      equipment,
      selectedEquipmentIdByProfile: { [profile.id]: equipment[0]!.id },
    });
    const screen = await render(
      <DashboardScreen
        controller={controller}
        navigation={{
          createEquipment: jest.fn(),
          createProfile: jest.fn(),
          editEquipment: jest.fn(),
          editProfile: jest.fn(),
          openProfile: jest.fn(),
          openLicences: jest.fn(),
        }}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));

    await fireEvent.press(
      screen.getByLabelText('Use Long-focus reflector with Bedroom window'),
    );

    expect(controller.selectEquipment).toHaveBeenCalledWith(
      profile.id,
      equipment[1]!.id,
    );
    expect(
      screen.getByLabelText('Use Long-focus reflector with Bedroom window')
        .props.accessibilityState,
    ).toEqual({ selected: true });
  });

  it('requires destructive confirmation before deleting equipment', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const controller = createController({
      profiles: [profile],
      equipment,
      selectedEquipmentIdByProfile: { [profile.id]: equipment[0]!.id },
    });
    const screen = await render(
      <DashboardScreen
        controller={controller}
        navigation={{
          createEquipment: jest.fn(),
          createProfile: jest.fn(),
          editEquipment: jest.fn(),
          editProfile: jest.fn(),
          openProfile: jest.fn(),
          openLicences: jest.fn(),
        }}
      />,
    );
    await waitFor(() => screen.getByText('Wide-field refractor'));

    await fireEvent.press(screen.getByLabelText('Delete Wide-field refractor'));
    expect(controller.deleteEquipment).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete imaging setup?',
      expect.stringContaining('affected profile'),
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls[0]?.[2];
    await act(async () => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    expect(controller.deleteEquipment).toHaveBeenCalledWith(equipment[0]!.id);
    alertSpy.mockRestore();
  });

  it('opens the selected observing profile Sky View', async () => {
    const dashboardNavigation = {
      createEquipment: jest.fn(),
      createProfile: jest.fn(),
      editEquipment: jest.fn(),
      editProfile: jest.fn(),
      openLicences: jest.fn(),
      openProfile: jest.fn(),
    };
    const screen = await render(
      <DashboardScreen
        controller={createController({
          profiles: [profile],
          equipment: [],
          selectedEquipmentIdByProfile: {},
        })}
        navigation={dashboardNavigation}
      />,
    );
    await waitFor(() => screen.getByText(profile.name));
    fireEvent.press(screen.getByLabelText(`Open ${profile.name} Sky View`));
    expect(dashboardNavigation.openProfile).toHaveBeenCalledWith(profile.id);
  });
});
