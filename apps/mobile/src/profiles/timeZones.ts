import { timeZonesNames } from '@vvo/tzdb';

export const ianaTimeZoneOptions = [...new Set(timeZonesNames)].sort((a, b) =>
  a.localeCompare(b),
);
