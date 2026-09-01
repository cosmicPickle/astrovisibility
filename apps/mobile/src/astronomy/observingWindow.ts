import {
  Body,
  Observer,
  SearchAltitude,
  SearchRiseSet,
} from 'astronomy-engine';

import type { ObserverLocation } from './horizontalCoordinates';
import {
  addDaysToLocalDate,
  localCivilDateTimeAtInstant,
  type LocalCivilDate,
  type LocalCivilTimeResolution,
  type ObservingWindow,
  resolveLocalCivilDateTime,
} from './localCivilTime';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const NO_ASTRONOMICAL_DARKNESS = 'No astronomical darkness';
const MINUTES_PER_DAY = 24 * 60;
const NOON_MINUTE_OF_DAY = 12 * 60;

const resolveOrdinaryBoundary = (
  resolution: LocalCivilTimeResolution,
  preference: 'earlier' | 'later',
): string => {
  if (resolution.kind === 'gap') {
    throw new Error(
      'Expected observing-window boundary does not exist locally',
    );
  }
  if (resolution.kind === 'unique') return resolution.timestampUtc;
  return preference === 'earlier'
    ? resolution.earlierTimestampUtc
    : resolution.laterTimestampUtc;
};

export const createDateObservingWindow = (input: {
  civilDate: LocalCivilDate;
  timeZoneId: string;
}): ObservingWindow => {
  const followingDate = addDaysToLocalDate(input.civilDate, 1);
  const startTimestampUtc = resolveOrdinaryBoundary(
    resolveLocalCivilDateTime(
      { ...input.civilDate, hour: 12, minute: 0 },
      input.timeZoneId,
    ),
    'earlier',
  );
  const endTimestampUtc = resolveOrdinaryBoundary(
    resolveLocalCivilDateTime(
      { ...followingDate, hour: 12, minute: 0 },
      input.timeZoneId,
    ),
    'later',
  );
  return {
    kind: 'day',
    startTimestampUtc,
    endTimestampUtc,
    note: null,
    warnings: [],
  };
};

export const getNoonCenteredObservingDate = (
  timestampUtc: string,
  timeZoneId: string,
): LocalCivilDate => {
  const local = localCivilDateTimeAtInstant(timestampUtc, timeZoneId);
  const localDate = { year: local.year, month: local.month, day: local.day };
  return local.hour < 12 ? addDaysToLocalDate(localDate, -1) : localDate;
};

const dateKey = (date: LocalCivilDate) =>
  Date.UTC(date.year, date.month - 1, date.day);

export const getNoonCenteredSliderMinute = (input: {
  civilDate: LocalCivilDate;
  timestampUtc: string;
  timeZoneId: string;
}): number => {
  const local = localCivilDateTimeAtInstant(
    input.timestampUtc,
    input.timeZoneId,
  );
  const localDate = { year: local.year, month: local.month, day: local.day };
  const dayOffset = Math.round(
    (dateKey(localDate) - dateKey(input.civilDate)) / MILLISECONDS_PER_DAY,
  );
  const minuteOfTrack =
    dayOffset * MINUTES_PER_DAY +
    local.hour * 60 +
    local.minute -
    NOON_MINUTE_OF_DAY;
  if (minuteOfTrack < 0 || minuteOfTrack >= MINUTES_PER_DAY) {
    throw new RangeError('Timestamp is outside the noon-centred observing day');
  }
  return minuteOfTrack;
};

const resolveForwardFromGap = (
  local: LocalCivilDate & { hour: number; minute: number },
  timeZoneId: string,
): string => {
  let candidate = local;
  for (let skippedMinutes = 0; skippedMinutes <= 180; skippedMinutes += 1) {
    const resolution = resolveLocalCivilDateTime(candidate, timeZoneId);
    if (resolution.kind === 'unique') return resolution.timestampUtc;
    if (resolution.kind === 'ambiguous') {
      return resolution.earlierTimestampUtc;
    }
    const normalized = new Date(
      Date.UTC(
        candidate.year,
        candidate.month - 1,
        candidate.day,
        candidate.hour,
        candidate.minute + 1,
      ),
    );
    candidate = {
      year: normalized.getUTCFullYear(),
      month: normalized.getUTCMonth() + 1,
      day: normalized.getUTCDate(),
      hour: normalized.getUTCHours(),
      minute: normalized.getUTCMinutes(),
    };
  }
  throw new Error('Slider time could not be resolved after a civil-time gap');
};

export const resolveNoonCenteredSliderTimestamp = (input: {
  civilDate: LocalCivilDate;
  minuteOfTrack: number;
  timeZoneId: string;
}): string => {
  if (
    !Number.isInteger(input.minuteOfTrack) ||
    input.minuteOfTrack < 0 ||
    input.minuteOfTrack >= MINUTES_PER_DAY
  ) {
    throw new RangeError(
      'minuteOfTrack must be an integer from 0 through 1439',
    );
  }
  const normalized = new Date(
    Date.UTC(
      input.civilDate.year,
      input.civilDate.month - 1,
      input.civilDate.day,
      12,
      input.minuteOfTrack,
    ),
  );
  return resolveForwardFromGap(
    {
      year: normalized.getUTCFullYear(),
      month: normalized.getUTCMonth() + 1,
      day: normalized.getUTCDate(),
      hour: normalized.getUTCHours(),
      minute: normalized.getUTCMinutes(),
    },
    input.timeZoneId,
  );
};

export const clampNoonCenteredTrackEndTimestamp = (input: {
  civilDate: LocalCivilDate;
  timeZoneId: string;
  timestampUtc: string;
  windowEndTimestampUtc: string;
}): string =>
  input.timestampUtc === input.windowEndTimestampUtc
    ? resolveNoonCenteredSliderTimestamp({
        civilDate: input.civilDate,
        minuteOfTrack: MINUTES_PER_DAY - 1,
        timeZoneId: input.timeZoneId,
      })
    : input.timestampUtc;

const findBoundedEvent = (
  search: (start: Date, limitDays: number) => { date: Date } | null,
  startMilliseconds: number,
  endMilliseconds: number,
): string | null => {
  const event = search(
    new Date(startMilliseconds),
    (endMilliseconds - startMilliseconds) / MILLISECONDS_PER_DAY,
  );
  const eventMilliseconds = event?.date.getTime();
  if (
    eventMilliseconds === undefined ||
    eventMilliseconds < startMilliseconds ||
    eventMilliseconds > endMilliseconds
  ) {
    return null;
  }
  return new Date(eventMilliseconds).toISOString();
};

export const createTonightObservingWindow = (input: {
  civilDate: LocalCivilDate;
  timeZoneId: string;
  observer: ObserverLocation;
}): ObservingWindow => {
  const followingDate = addDaysToLocalDate(input.civilDate, 1);
  const searchStartTimestampUtc = resolveOrdinaryBoundary(
    resolveLocalCivilDateTime(
      { ...input.civilDate, hour: 12, minute: 0 },
      input.timeZoneId,
    ),
    'earlier',
  );
  const searchEndTimestampUtc = resolveOrdinaryBoundary(
    resolveLocalCivilDateTime(
      { ...followingDate, hour: 12, minute: 0 },
      input.timeZoneId,
    ),
    'later',
  );
  const searchStartMilliseconds = Date.parse(searchStartTimestampUtc);
  const searchEndMilliseconds = Date.parse(searchEndTimestampUtc);
  const observer = new Observer(
    input.observer.latitudeDegreesNorth,
    input.observer.longitudeDegreesEast,
    input.observer.elevationMetersAboveMeanSeaLevel,
  );

  const duskTimestampUtc = findBoundedEvent(
    (start, limitDays) =>
      SearchAltitude(Body.Sun, observer, -1, start, limitDays, -18),
    searchStartMilliseconds,
    searchEndMilliseconds,
  );
  const duskMilliseconds = duskTimestampUtc
    ? Date.parse(duskTimestampUtc)
    : searchStartMilliseconds;
  const dawnTimestampUtc = duskTimestampUtc
    ? findBoundedEvent(
        (start, limitDays) =>
          SearchAltitude(Body.Sun, observer, +1, start, limitDays, -18),
        duskMilliseconds + 1,
        searchEndMilliseconds,
      )
    : null;
  if (duskTimestampUtc && dawnTimestampUtc) {
    return {
      kind: 'astronomicalDarkness',
      startTimestampUtc: duskTimestampUtc,
      endTimestampUtc: dawnTimestampUtc,
      note: null,
      warnings: [],
    };
  }

  const sunsetTimestampUtc = findBoundedEvent(
    (start, limitDays) =>
      SearchRiseSet(Body.Sun, observer, -1, start, limitDays),
    searchStartMilliseconds,
    searchEndMilliseconds,
  );
  const sunsetMilliseconds = sunsetTimestampUtc
    ? Date.parse(sunsetTimestampUtc)
    : searchStartMilliseconds;
  const sunriseTimestampUtc = sunsetTimestampUtc
    ? findBoundedEvent(
        (start, limitDays) =>
          SearchRiseSet(Body.Sun, observer, +1, start, limitDays),
        sunsetMilliseconds + 1,
        searchEndMilliseconds,
      )
    : null;
  if (sunsetTimestampUtc && sunriseTimestampUtc) {
    return {
      kind: 'sunsetSunrise',
      startTimestampUtc: sunsetTimestampUtc,
      endTimestampUtc: sunriseTimestampUtc,
      note: NO_ASTRONOMICAL_DARKNESS,
      warnings: [],
    };
  }

  return {
    kind: 'civilFallback',
    startTimestampUtc: resolveOrdinaryBoundary(
      resolveLocalCivilDateTime(
        { ...input.civilDate, hour: 18, minute: 0 },
        input.timeZoneId,
      ),
      'earlier',
    ),
    endTimestampUtc: resolveOrdinaryBoundary(
      resolveLocalCivilDateTime(
        { ...followingDate, hour: 6, minute: 0 },
        input.timeZoneId,
      ),
      'later',
    ),
    note: NO_ASTRONOMICAL_DARKNESS,
    warnings: [
      'Sunset and sunrise are unavailable; using 18:00–06:00 local time.',
    ],
  };
};

export const createDefaultObservingContext = (input: {
  nowTimestampUtc: string;
  observer: ObserverLocation;
  timeZoneId: string;
}): Readonly<{
  sceneTimestampUtc: string;
  window: ObservingWindow;
}> => {
  const nowMilliseconds = Date.parse(input.nowTimestampUtc);
  if (!input.nowTimestampUtc.endsWith('Z') || Number.isNaN(nowMilliseconds)) {
    throw new TypeError('nowTimestampUtc must be a valid UTC instant');
  }
  const localNow = localCivilDateTimeAtInstant(
    input.nowTimestampUtc,
    input.timeZoneId,
  );
  const todayWindow = createTonightObservingWindow({
    civilDate: localNow,
    observer: input.observer,
    timeZoneId: input.timeZoneId,
  });
  const previousWindow = createTonightObservingWindow({
    civilDate: addDaysToLocalDate(localNow, -1),
    observer: input.observer,
    timeZoneId: input.timeZoneId,
  });
  const activeWindow = [previousWindow, todayWindow].find(
    ({ startTimestampUtc, endTimestampUtc }) =>
      nowMilliseconds >= Date.parse(startTimestampUtc) &&
      nowMilliseconds <= Date.parse(endTimestampUtc),
  );
  return activeWindow
    ? { sceneTimestampUtc: input.nowTimestampUtc, window: activeWindow }
    : {
        sceneTimestampUtc: todayWindow.startTimestampUtc,
        window: todayWindow,
      };
};
