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
