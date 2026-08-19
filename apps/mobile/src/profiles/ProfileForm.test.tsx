import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ProfileForm } from './profile-form';
import { createProfileFormDefaults } from './profileForm';

describe('ProfileForm', () => {
  it('saves a valid manually entered profile after location denial', async () => {
    const onSave = jest.fn();
    const locationClient = {
      requestCurrentLocation: jest.fn().mockResolvedValue({
        status: 'denied',
        canAskAgain: true,
      }),
      openSettings: jest.fn(),
    };
    const screen = await render(
      <ProfileForm
        initialValues={createProfileFormDefaults('Europe/Sofia')}
        locationClient={locationClient}
        onSave={onSave}
        title="New observing profile"
      />,
    );

    await fireEvent.press(screen.getByText('Use current location'));
    expect(
      screen.getByText(
        'Location permission was denied. Enter coordinates manually or retry.',
      ),
    ).toBeTruthy();

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

  it('fills coordinates once after permission and keeps them editable', async () => {
    const locationClient = {
      requestCurrentLocation: jest.fn().mockResolvedValue({
        status: 'granted',
        latitudeDegreesNorth: 51.5,
        longitudeDegreesEast: -0.12,
        elevationMetersAboveMeanSeaLevel: 35,
        locationAccuracyMeters: 7,
      }),
      openSettings: jest.fn(),
    };
    const screen = await render(
      <ProfileForm
        initialValues={createProfileFormDefaults('Europe/London')}
        locationClient={locationClient}
        onSave={jest.fn()}
        title="New observing profile"
      />,
    );

    await fireEvent.press(screen.getByText('Use current location'));

    expect(screen.getByLabelText('Latitude').props.value).toBe('51.5');
    expect(screen.getByLabelText('Longitude').props.value).toBe('-0.12');
    expect(
      screen.getByText('Location acquired within about 7 m.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Latitude').props.editable).not.toBe(false);
  });

  it('shows a field error instead of submitting invalid coordinates', async () => {
    const onSave = jest.fn();
    const screen = await render(
      <ProfileForm
        initialValues={{
          ...createProfileFormDefaults('Europe/Sofia'),
          name: 'Garden',
          latitudeDegreesNorth: '92',
          longitudeDegreesEast: '23',
        }}
        onSave={onSave}
        title="New observing profile"
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
