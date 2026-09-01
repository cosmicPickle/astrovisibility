import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchRiseSet,
} from 'astronomy-engine';

import type { ObserverLocation } from './horizontalCoordinates';
import {
  localCivilDateTimeAtInstant,
  type ObservingWindow,
} from './localCivilTime';
import {
  getNoonCenteredObservingDate,
  resolveNoonCenteredSliderTimestamp,
} from './observingWindow';
import { createAstronomicalDarknessIntervals } from './astronomicalDarkness';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SKY_TRACK_SAMPLE_COUNT = 49;
const ASTRONOMICAL_NIGHT_ALTITUDE_DEGREES = -18;
const APPARENT_HORIZON_ALTITUDE_DEGREES = -0.833;

export type SkyConditionName =
  'Daylight' | 'Dusk' | 'Dark night' | 'Moonlight' | 'Dawn';

export interface SkyConditionSample {
  color: string;
  condition: SkyConditionName;
  moonlightStrength: number;
  offsetPercent: number;
  timestampUtc: string;
}

export type AstronomicalDarknessSpan =
  | { kind: 'none' }
  | { kind: 'allDay' }
  | {
      kind: 'bounded';
      endTimestampUtc: string;
      startTimestampUtc: string;
    };

export interface MoonConditions {
  illuminatedPercent: number;
  phaseDegrees: number;
  phaseName:
    | 'New Moon'
    | 'Waxing Crescent'
    | 'First Quarter'
    | 'Waxing Gibbous'
    | 'Full Moon'
    | 'Waning Gibbous'
    | 'Last Quarter'
    | 'Waning Crescent';
  riseLocalTime: string | null;
  setLocalTime: string | null;
}

const observerFromLocation = (location: ObserverLocation) =>
  new Observer(
    location.latitudeDegreesNorth,
    location.longitudeDegreesEast,
    location.elevationMetersAboveMeanSeaLevel,
  );

const altitudeDegrees = (body: Body, observer: Observer, date: Date) => {
  const equatorial = Equator(body, date, observer, true, true);
  return Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal')
    .altitude;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const mixColor = (
  dark: readonly [number, number, number],
  light: readonly [number, number, number],
  amount: number,
) => {
  const boundedAmount = clamp01(amount);
  const channel = (index: 0 | 1 | 2) =>
    Math.round(dark[index] + (light[index] - dark[index]) * boundedAmount)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

const nightColor = (moonlightStrength: number) =>
  mixColor([3, 7, 17], [42, 77, 126], moonlightStrength * 0.72);

const colorFor = (sunAltitudeDegrees: number, moonlightStrength: number) => {
  const darkColor = nightColor(moonlightStrength);
  if (sunAltitudeDegrees <= ASTRONOMICAL_NIGHT_ALTITUDE_DEGREES) {
    return darkColor;
  }
  if (sunAltitudeDegrees >= APPARENT_HORIZON_ALTITUDE_DEGREES) {
    return '#72b9f2';
  }
  const twilightAmount =
    (sunAltitudeDegrees - ASTRONOMICAL_NIGHT_ALTITUDE_DEGREES) /
    (APPARENT_HORIZON_ALTITUDE_DEGREES - ASTRONOMICAL_NIGHT_ALTITUDE_DEGREES);
  const dark = [
    Number.parseInt(darkColor.slice(1, 3), 16),
    Number.parseInt(darkColor.slice(3, 5), 16),
    Number.parseInt(darkColor.slice(5, 7), 16),
  ] as const;
  return mixColor(dark, [114, 185, 242], Math.sqrt(clamp01(twilightAmount)));
};

export const createSkyConditionTrack = (input: {
  observer: ObserverLocation;
  timeZoneId: string;
  window: Pick<ObservingWindow, 'startTimestampUtc' | 'endTimestampUtc'>;
}): SkyConditionSample[] => {
  const observingDate = getNoonCenteredObservingDate(
    input.window.startTimestampUtc,
    input.timeZoneId,
  );
  const observer = observerFromLocation(input.observer);
  const midpointTimestampUtc = resolveNoonCenteredSliderTimestamp({
    civilDate: observingDate,
    minuteOfTrack: 720,
    timeZoneId: input.timeZoneId,
  });
  const illuminatedFraction = Illumination(
    Body.Moon,
    new Date(midpointTimestampUtc),
  ).phase_fraction;
  const rawSamples = Array.from(
    { length: SKY_TRACK_SAMPLE_COUNT },
    (_, index) => {
      const offsetPercent = index / (SKY_TRACK_SAMPLE_COUNT - 1);
      const minuteOfTrack = Math.min(1439, Math.round(offsetPercent * 1440));
      const timestampUtc = resolveNoonCenteredSliderTimestamp({
        civilDate: observingDate,
        minuteOfTrack,
        timeZoneId: input.timeZoneId,
      });
      const date = new Date(timestampUtc);
      const sunAltitudeDegrees = altitudeDegrees(Body.Sun, observer, date);
      const moonAltitudeDegrees = altitudeDegrees(Body.Moon, observer, date);
      const moonlightStrength =
        illuminatedFraction *
        Math.max(0, Math.sin((moonAltitudeDegrees * Math.PI) / 180));
      return {
        moonlightStrength,
        offsetPercent,
        sunAltitudeDegrees,
        timestampUtc,
      };
    },
  );
  return rawSamples.map((sample, index) => {
    let condition: SkyConditionName;
    if (sample.sunAltitudeDegrees >= APPARENT_HORIZON_ALTITUDE_DEGREES) {
      condition = 'Daylight';
    } else if (
      sample.sunAltitudeDegrees <= ASTRONOMICAL_NIGHT_ALTITUDE_DEGREES
    ) {
      condition = sample.moonlightStrength >= 0.03 ? 'Moonlight' : 'Dark night';
    } else {
      const previousAltitude =
        rawSamples[Math.max(0, index - 1)]!.sunAltitudeDegrees;
      const nextAltitude =
        rawSamples[Math.min(rawSamples.length - 1, index + 1)]!
          .sunAltitudeDegrees;
      condition = nextAltitude >= previousAltitude ? 'Dawn' : 'Dusk';
    }
    return {
      color: colorFor(sample.sunAltitudeDegrees, sample.moonlightStrength),
      condition,
      moonlightStrength: sample.moonlightStrength,
      offsetPercent: sample.offsetPercent,
      timestampUtc: sample.timestampUtc,
    };
  });
};

export const createAstronomicalDarknessSpan = (
  observer: ObserverLocation,
  window: Pick<ObservingWindow, 'startTimestampUtc' | 'endTimestampUtc'>,
): AstronomicalDarknessSpan => {
  const intervals = createAstronomicalDarknessIntervals(observer, window);
  if (intervals.length === 0) return { kind: 'none' };
  const longest = [...intervals].sort(
    (left, right) => right.durationMilliseconds - left.durationMilliseconds,
  )[0]!;
  if (
    Date.parse(longest.startTimestampUtc) <=
      Date.parse(window.startTimestampUtc) &&
    Date.parse(longest.endTimestampUtc) >= Date.parse(window.endTimestampUtc)
  ) {
    return { kind: 'allDay' };
  }
  return {
    kind: 'bounded',
    startTimestampUtc: longest.startTimestampUtc,
    endTimestampUtc: longest.endTimestampUtc,
  };
};

const phaseNameFor = (phaseDegrees: number): MoonConditions['phaseName'] => {
  const normalized = ((phaseDegrees % 360) + 360) % 360;
  if (normalized < 22.5 || normalized >= 337.5) return 'New Moon';
  if (normalized < 67.5) return 'Waxing Crescent';
  if (normalized < 112.5) return 'First Quarter';
  if (normalized < 157.5) return 'Waxing Gibbous';
  if (normalized < 202.5) return 'Full Moon';
  if (normalized < 247.5) return 'Waning Gibbous';
  if (normalized < 292.5) return 'Last Quarter';
  return 'Waning Crescent';
};

const boundedMoonEvent = (
  observer: Observer,
  direction: 1 | -1,
  window: Pick<ObservingWindow, 'startTimestampUtc' | 'endTimestampUtc'>,
) => {
  const startMilliseconds = Date.parse(window.startTimestampUtc);
  const endMilliseconds = Date.parse(window.endTimestampUtc);
  const event = SearchRiseSet(
    Body.Moon,
    observer,
    direction,
    new Date(startMilliseconds),
    (endMilliseconds - startMilliseconds) / MILLISECONDS_PER_DAY,
  );
  const eventMilliseconds = event?.date.getTime();
  return eventMilliseconds !== undefined &&
    eventMilliseconds >= startMilliseconds &&
    eventMilliseconds < endMilliseconds
    ? new Date(eventMilliseconds).toISOString()
    : null;
};

const formatLocalTime = (timestampUtc: string | null, timeZoneId: string) => {
  if (!timestampUtc) return null;
  const local = localCivilDateTimeAtInstant(timestampUtc, timeZoneId);
  return `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
};

export const createMoonConditions = (input: {
  observer: ObserverLocation;
  timestampUtc: string;
  timeZoneId: string;
  window: Pick<ObservingWindow, 'startTimestampUtc' | 'endTimestampUtc'>;
}): MoonConditions => {
  const date = new Date(input.timestampUtc);
  const phaseDegrees = MoonPhase(date);
  const observer = observerFromLocation(input.observer);
  return {
    illuminatedPercent: Math.round(
      Illumination(Body.Moon, date).phase_fraction * 100,
    ),
    phaseDegrees,
    phaseName: phaseNameFor(phaseDegrees),
    riseLocalTime: formatLocalTime(
      boundedMoonEvent(observer, 1, input.window),
      input.timeZoneId,
    ),
    setLocalTime: formatLocalTime(
      boundedMoonEvent(observer, -1, input.window),
      input.timeZoneId,
    ),
  };
};
