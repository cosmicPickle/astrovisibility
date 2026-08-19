import type { ProfileRecord } from '../storage/profileRepository';

export interface ProfileFormValues {
  name: string;
  latitudeDegreesNorth: string;
  longitudeDegreesEast: string;
  elevationMetersAboveMeanSeaLevel: string;
  timeZoneId: string;
  locationAccuracyMeters: number | null;
}

export type ProfileFormData = Omit<
  ProfileRecord,
  'id' | 'createdAtUtc' | 'updatedAtUtc'
>;

export type ProfileFormResult =
  | { success: true; data: ProfileFormData }
  | {
      success: false;
      field: keyof ProfileFormValues;
      message: string;
    };

function parseFiniteNumber(
  value: string,
  field: keyof ProfileFormValues,
  message: string,
): ProfileFormResult | number {
  const parsed = Number(value.trim());
  if (value.trim() === '' || !Number.isFinite(parsed)) {
    return { success: false, field, message };
  }
  return parsed;
}

export function isValidIanaTimeZone(timeZoneId: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timeZoneId }).format();
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZoneId(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidIanaTimeZone(detected) ? detected : 'UTC';
}

export function createProfileFormDefaults(
  timeZoneId = deviceTimeZoneId(),
): ProfileFormValues {
  return {
    name: '',
    latitudeDegreesNorth: '',
    longitudeDegreesEast: '',
    elevationMetersAboveMeanSeaLevel: '',
    timeZoneId,
    locationAccuracyMeters: null,
  };
}

export function profileToFormValues(profile: ProfileRecord): ProfileFormValues {
  return {
    name: profile.name,
    latitudeDegreesNorth: String(profile.latitudeDegreesNorth),
    longitudeDegreesEast: String(profile.longitudeDegreesEast),
    elevationMetersAboveMeanSeaLevel: String(
      profile.elevationMetersAboveMeanSeaLevel,
    ),
    timeZoneId: profile.timeZoneId,
    locationAccuracyMeters: profile.locationAccuracyMeters ?? null,
  };
}

export function parseProfileForm(values: ProfileFormValues): ProfileFormResult {
  const name = values.name.trim();
  if (name.length === 0 || name.length > 120) {
    return {
      success: false,
      field: 'name',
      message: 'Enter a name between 1 and 120 characters.',
    };
  }

  const latitude = parseFiniteNumber(
    values.latitudeDegreesNorth,
    'latitudeDegreesNorth',
    'Enter a valid latitude.',
  );
  if (typeof latitude !== 'number') return latitude;
  if (latitude < -90 || latitude > 90) {
    return {
      success: false,
      field: 'latitudeDegreesNorth',
      message: 'Latitude must be between -90 and 90.',
    };
  }

  const longitude = parseFiniteNumber(
    values.longitudeDegreesEast,
    'longitudeDegreesEast',
    'Enter a valid longitude.',
  );
  if (typeof longitude !== 'number') return longitude;
  if (longitude < -180 || longitude > 180) {
    return {
      success: false,
      field: 'longitudeDegreesEast',
      message: 'Longitude must be between -180 and 180.',
    };
  }

  const elevationText = values.elevationMetersAboveMeanSeaLevel.trim();
  const elevation = elevationText === '' ? 0 : Number(elevationText);
  if (!Number.isFinite(elevation)) {
    return {
      success: false,
      field: 'elevationMetersAboveMeanSeaLevel',
      message: 'Enter a valid elevation in metres.',
    };
  }

  const timeZoneId = values.timeZoneId.trim();
  if (!isValidIanaTimeZone(timeZoneId)) {
    return {
      success: false,
      field: 'timeZoneId',
      message: 'Enter a valid IANA timezone.',
    };
  }

  const locationAccuracyMeters = values.locationAccuracyMeters;
  if (
    locationAccuracyMeters !== null &&
    (!Number.isFinite(locationAccuracyMeters) || locationAccuracyMeters < 0)
  ) {
    return {
      success: false,
      field: 'locationAccuracyMeters',
      message: 'Location accuracy is invalid. Enter coordinates manually.',
    };
  }

  return {
    success: true,
    data: {
      name,
      latitudeDegreesNorth: latitude,
      longitudeDegreesEast: longitude,
      elevationMetersAboveMeanSeaLevel: elevation,
      timeZoneId,
      locationAccuracyMeters,
    },
  };
}
