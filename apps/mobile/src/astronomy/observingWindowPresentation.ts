import type {
  LocalCivilDate,
  LocalCivilDateTime,
  ObservingWindow,
} from './localCivilTime';
import { localCivilDateTimeAtInstant } from './localCivilTime';
import type { AboveHorizonInterval } from './trajectory';

export const formatLocalDateInput = (date: LocalCivilDate) =>
  `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;

export const formatLocalTimeInput = (
  time: Pick<LocalCivilDateTime, 'hour' | 'minute'>,
) =>
  `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;

export const formatObservingWindowRange = (
  window: Pick<ObservingWindow, 'startTimestampUtc' | 'endTimestampUtc'>,
  timeZoneId: string,
) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: timeZoneId,
  });
  return `${formatter.format(new Date(window.startTimestampUtc))} – ${formatter.format(new Date(window.endTimestampUtc))}`;
};

export const formatSceneControlLabel = (
  timestampUtc: string,
  timeZoneId: string,
) => {
  const local = localCivilDateTimeAtInstant(timestampUtc, timeZoneId);
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: timeZoneId,
  }).format(new Date(timestampUtc));
  return `${formatLocalTimeInput(local)} · ${dateLabel}`;
};

export const formatDuration = (durationMilliseconds: number) => {
  const totalMinutes = Math.max(0, Math.round(durationMilliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

export const formatAboveHorizonIntervals = (
  intervals: readonly AboveHorizonInterval[],
  timeZoneId: string,
) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: timeZoneId,
  });
  return intervals.map(
    (interval) =>
      `${formatter.format(new Date(interval.startTimestampUtc))}–${formatter.format(new Date(interval.endTimestampUtc))}`,
  );
};
