import { createProfileFormDefaults, parseProfileForm } from './profileForm';

describe('profile form validation', () => {
  it('normalizes a valid manually entered observing position', () => {
    expect(
      parseProfileForm({
        name: '  Balcony corner  ',
        latitudeDegreesNorth: '42.6977',
        longitudeDegreesEast: '23.3219',
        elevationMetersAboveMeanSeaLevel: '',
        timeZoneId: ' Europe/Sofia ',
        locationAccuracyMeters: null,
      }),
    ).toEqual({
      success: true,
      data: {
        name: 'Balcony corner',
        latitudeDegreesNorth: 42.6977,
        longitudeDegreesEast: 23.3219,
        elevationMetersAboveMeanSeaLevel: 0,
        timeZoneId: 'Europe/Sofia',
        locationAccuracyMeters: null,
      },
    });
  });

  it.each([
    ['latitudeDegreesNorth', '91', 'Latitude must be between -90 and 90.'],
    ['longitudeDegreesEast', '-181', 'Longitude must be between -180 and 180.'],
    ['latitudeDegreesNorth', 'north', 'Enter a valid latitude.'],
    ['timeZoneId', 'Mars/Olympus', 'Enter a valid IANA timezone.'],
  ] as const)('rejects an invalid %s', (field, value, message) => {
    const result = parseProfileForm({
      name: 'Back garden',
      latitudeDegreesNorth: '42',
      longitudeDegreesEast: '23',
      elevationMetersAboveMeanSeaLevel: '550',
      timeZoneId: 'Europe/Sofia',
      locationAccuracyMeters: null,
      [field]: value,
    });

    expect(result).toEqual({ success: false, field, message });
  });

  it('uses the device IANA timezone when creating defaults', () => {
    expect(createProfileFormDefaults('America/New_York').timeZoneId).toBe(
      'America/New_York',
    );
  });

  it('accepts UTC as an IANA timezone without a region separator', () => {
    expect(
      parseProfileForm({
        ...createProfileFormDefaults('UTC'),
        name: 'Remote site',
        latitudeDegreesNorth: '0',
        longitudeDegreesEast: '0',
      }).success,
    ).toBe(true);
  });
});
