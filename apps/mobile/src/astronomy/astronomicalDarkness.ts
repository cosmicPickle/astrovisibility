import {
  Body,
  Equator,
  Horizon,
  Observer,
  SearchAltitude,
} from 'astronomy-engine';

import type { ObserverLocation } from './horizontalCoordinates';
import type { VisibilityInterval } from './trajectory';

const ASTRONOMICAL_DARKNESS_ALTITUDE_DEGREES = -18;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const parseWindow = (window: {
  startTimestampUtc: string;
  endTimestampUtc: string;
}) => {
  const startMilliseconds = Date.parse(window.startTimestampUtc);
  const endMilliseconds = Date.parse(window.endTimestampUtc);
  if (
    !window.startTimestampUtc.endsWith('Z') ||
    !window.endTimestampUtc.endsWith('Z') ||
    Number.isNaN(startMilliseconds) ||
    Number.isNaN(endMilliseconds)
  ) {
    throw new TypeError('Darkness window must contain valid UTC instants.');
  }
  if (
    endMilliseconds <= startMilliseconds ||
    endMilliseconds - startMilliseconds > MILLISECONDS_PER_DAY
  ) {
    throw new RangeError(
      'Darkness window must be greater than 0 and at most 24 hours.',
    );
  }
  return { startMilliseconds, endMilliseconds };
};

const createInterval = (
  startMilliseconds: number,
  endMilliseconds: number,
): VisibilityInterval => ({
  startTimestampUtc: new Date(startMilliseconds).toISOString(),
  endTimestampUtc: new Date(endMilliseconds).toISOString(),
  durationMilliseconds: endMilliseconds - startMilliseconds,
});

const findCrossings = (
  observer: Observer,
  startMilliseconds: number,
  endMilliseconds: number,
): number[] => {
  const crossings: number[] = [];
  for (const direction of [-1, 1] as const) {
    const event = SearchAltitude(
      Body.Sun,
      observer,
      direction,
      new Date(startMilliseconds),
      (endMilliseconds - startMilliseconds) / MILLISECONDS_PER_DAY,
      ASTRONOMICAL_DARKNESS_ALTITUDE_DEGREES,
    );
    const eventMilliseconds = event?.date.getTime();
    if (
      eventMilliseconds !== undefined &&
      eventMilliseconds > startMilliseconds &&
      eventMilliseconds < endMilliseconds
    ) {
      crossings.push(eventMilliseconds);
    }
  }
  return crossings.sort((left, right) => left - right);
};

const sunAltitudeDegrees = (observer: Observer, timestamp: Date): number => {
  const equatorial = Equator(Body.Sun, timestamp, observer, true, true);
  return Horizon(timestamp, observer, equatorial.ra, equatorial.dec, 'normal')
    .altitude;
};

export const createAstronomicalDarknessIntervals = (
  observerLocation: ObserverLocation,
  window: { startTimestampUtc: string; endTimestampUtc: string },
): VisibilityInterval[] => {
  const { startMilliseconds, endMilliseconds } = parseWindow(window);
  const observer = new Observer(
    observerLocation.latitudeDegreesNorth,
    observerLocation.longitudeDegreesEast,
    observerLocation.elevationMetersAboveMeanSeaLevel,
  );
  const boundaries = [
    startMilliseconds,
    ...findCrossings(observer, startMilliseconds, endMilliseconds),
    endMilliseconds,
  ];
  const intervals: VisibilityInterval[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const intervalStart = boundaries[index]!;
    const intervalEnd = boundaries[index + 1]!;
    const midpoint = new Date(
      intervalStart + (intervalEnd - intervalStart) / 2,
    );
    if (
      sunAltitudeDegrees(observer, midpoint) <=
      ASTRONOMICAL_DARKNESS_ALTITUDE_DEGREES
    ) {
      intervals.push(createInterval(intervalStart, intervalEnd));
    }
  }
  return intervals;
};

export const intersectTimeIntervals = (
  leftIntervals: readonly VisibilityInterval[],
  rightIntervals: readonly VisibilityInterval[],
): VisibilityInterval[] => {
  const left = [...leftIntervals].sort(
    (first, second) =>
      Date.parse(first.startTimestampUtc) -
      Date.parse(second.startTimestampUtc),
  );
  const right = [...rightIntervals].sort(
    (first, second) =>
      Date.parse(first.startTimestampUtc) -
      Date.parse(second.startTimestampUtc),
  );
  const intersections: VisibilityInterval[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftInterval = left[leftIndex]!;
    const rightInterval = right[rightIndex]!;
    const startMilliseconds = Math.max(
      Date.parse(leftInterval.startTimestampUtc),
      Date.parse(rightInterval.startTimestampUtc),
    );
    const leftEndMilliseconds = Date.parse(leftInterval.endTimestampUtc);
    const rightEndMilliseconds = Date.parse(rightInterval.endTimestampUtc);
    const endMilliseconds = Math.min(leftEndMilliseconds, rightEndMilliseconds);
    if (endMilliseconds > startMilliseconds) {
      intersections.push(createInterval(startMilliseconds, endMilliseconds));
    }
    if (leftEndMilliseconds <= rightEndMilliseconds) leftIndex += 1;
    else rightIndex += 1;
  }
  return intersections;
};

export const isTimestampInIntervals = (
  timestampUtc: string,
  intervals: readonly VisibilityInterval[],
): boolean => {
  const timestampMilliseconds = Date.parse(timestampUtc);
  return intervals.some(
    (interval) =>
      timestampMilliseconds >= Date.parse(interval.startTimestampUtc) &&
      timestampMilliseconds < Date.parse(interval.endTimestampUtc),
  );
};
