import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProfileForm } from './profile-form';
import { createProfileFormDefaults } from './profileForm';

const grantedLocation = {
  status: 'granted' as const,
  latitudeDegreesNorth: 51.5,
  longitudeDegreesEast: -0.12,
  elevationMetersAboveMeanSeaLevel: 35,
  locationAccuracyMeters: 7,
};

const SafeAreaTestProvider = ({ children }: PropsWithChildren) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { height: 800, width: 400, x: 0, y: 0 },
      insets: { bottom: 0, left: 0, right: 0, top: 0 },
    }}
  >
    {children}
  </SafeAreaProvider>
);

const renderProfile = (component: ReactElement) =>
  render(component, { wrapper: SafeAreaTestProvider });

describe('ProfileForm', () => {
  it('requests current location on mount and reveals blank custom fields after denial', async () => {
    const onSave = jest.fn();
    const locationClient = {
      requestCurrentLocation: jest.fn().mockResolvedValue({
        status: 'denied',
        canAskAgain: true,
      }),
      openSettings: jest.fn(),
    };
    const screen = await renderProfile(
      <ProfileForm
        currentTimeZoneId="Europe/Sofia"
        initialValues={createProfileFormDefaults('Europe/Sofia')}
        locationClient={locationClient}
        onSave={onSave}
        timeZoneOptions={['Europe/London', 'Europe/Sofia', 'UTC']}
        title="New observing profile"
      />,
    );

    await waitFor(() =>
      expect(locationClient.requestCurrentLocation).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.getByLabelText('Use custom location').props.accessibilityState,
    ).toEqual({ selected: true });
    expect(screen.getByLabelText('Latitude')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Bedroom window')).toBeNull();
    expect(screen.queryByPlaceholderText('42.6977')).toBeNull();

    await fireEvent.changeText(
      screen.getByLabelText('Profile name'),
      'Balcony',
    );
    await fireEvent.changeText(screen.getByLabelText('Latitude'), '42.6977');
    await fireEvent.changeText(screen.getByLabelText('Longitude'), '23.3219');
    await fireEvent.changeText(screen.getByLabelText('Elevation'), '550');
    await fireEvent.press(screen.getByText('Save profile'));

    expect(onSave).toHaveBeenCalledWith({
      name: 'Balcony',
      latitudeDegreesNorth: 42.6977,
      longitudeDegreesEast: 23.3219,
      elevationMetersAboveMeanSeaLevel: 550,
      timeZoneId: 'Europe/Sofia',
      locationAccuracyMeters: null,
    });
  });

  it('keeps granted current coordinates hidden and saves them', async () => {
    const onSave = jest.fn();
    const locationClient = {
      requestCurrentLocation: jest.fn().mockResolvedValue(grantedLocation),
      openSettings: jest.fn(),
    };
    const screen = await renderProfile(
      <ProfileForm
        currentTimeZoneId="Europe/London"
        initialValues={createProfileFormDefaults('Europe/London')}
        locationClient={locationClient}
        onSave={onSave}
        timeZoneOptions={['Europe/London', 'UTC']}
        title="New observing profile"
      />,
    );

    await waitFor(() =>
      expect(locationClient.requestCurrentLocation).toHaveBeenCalledTimes(1),
    );
    expect(screen.queryByLabelText('Latitude')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Profile name'), 'Roof');
    await fireEvent.press(screen.getByText('Save profile'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        latitudeDegreesNorth: 51.5,
        longitudeDegreesEast: -0.12,
        timeZoneId: 'Europe/London',
      }),
    );
  });

  it('requests permission again whenever Current location is selected', async () => {
    const locationClient = {
      requestCurrentLocation: jest
        .fn()
        .mockResolvedValueOnce({ status: 'denied', canAskAgain: true })
        .mockResolvedValueOnce(grantedLocation),
      openSettings: jest.fn(),
    };
    const screen = await renderProfile(
      <ProfileForm
        currentTimeZoneId="UTC"
        initialValues={createProfileFormDefaults('UTC')}
        locationClient={locationClient}
        onSave={jest.fn()}
        timeZoneOptions={['UTC']}
        title="New observing profile"
      />,
    );

    await waitFor(() => screen.getByLabelText('Latitude'));
    await fireEvent.press(screen.getByLabelText('Use current location'));
    await waitFor(() =>
      expect(locationClient.requestCurrentLocation).toHaveBeenCalledTimes(2),
    );
    expect(screen.queryByLabelText('Latitude')).toBeNull();
  });

  it('uses an offline dropdown only when Custom timezone is selected', async () => {
    const initialValues = {
      ...createProfileFormDefaults('UTC'),
      latitudeDegreesNorth: '42',
      longitudeDegreesEast: '23',
    };
    const screen = await renderProfile(
      <ProfileForm
        currentTimeZoneId="UTC"
        initialValues={initialValues}
        locationClient={{
          requestCurrentLocation: jest.fn(),
          openSettings: jest.fn(),
        }}
        onSave={jest.fn()}
        timeZoneOptions={['Europe/London', 'Europe/Sofia', 'UTC']}
        title="Edit observing profile"
      />,
    );

    expect(screen.queryByLabelText('Choose timezone')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Use custom timezone'));
    await fireEvent.press(screen.getByLabelText('Choose timezone'));
    expect(screen.getByText('Europe/London')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Select Europe/London'));
    expect(screen.getByText('Europe/London')).toBeTruthy();
  });

  it('shows a field error instead of submitting invalid custom coordinates', async () => {
    const onSave = jest.fn();
    const screen = await renderProfile(
      <ProfileForm
        currentTimeZoneId="Europe/Sofia"
        initialValues={{
          ...createProfileFormDefaults('Europe/Sofia'),
          name: 'Garden',
          latitudeDegreesNorth: '92',
          longitudeDegreesEast: '23',
        }}
        locationClient={{
          requestCurrentLocation: jest.fn(),
          openSettings: jest.fn(),
        }}
        onSave={onSave}
        timeZoneOptions={['Europe/Sofia']}
        title="Edit observing profile"
      />,
    );

    await fireEvent.press(screen.getByText('Save profile'));
    await waitFor(() =>
      expect(
        screen.getByText('Latitude must be between -90 and 90.'),
      ).toBeTruthy(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});
