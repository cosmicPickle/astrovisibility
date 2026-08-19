import {
  createCustomObservingWindow,
  type AmbiguousTimeChoice,
  type CustomObservingWindowResult,
  type LocalCivilDate,
  type LocalCivilDateTime,
} from './localCivilTime';

export interface CustomObservingWindowFormValues {
  timeZoneId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  startAmbiguity?: AmbiguousTimeChoice;
  endAmbiguity?: AmbiguousTimeChoice;
}

export type CustomObservingWindowFormResult =
  | CustomObservingWindowResult
  | {
      success: false;
      issue:
        | 'invalidStartDate'
        | 'invalidStartTime'
        | 'invalidEndDate'
        | 'invalidEndTime';
    };

export const parseLocalCivilDate = (value: string): LocalCivilDate | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() + 1 !== month ||
    normalized.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
};

export const parseLocalCivilTime = (
  value: string,
): Pick<LocalCivilDateTime, 'hour' | 'minute'> | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
};

export const createCustomWindowFromForm = (
  values: CustomObservingWindowFormValues,
): CustomObservingWindowFormResult => {
  const startDate = parseLocalCivilDate(values.startDate);
  if (!startDate) return { success: false, issue: 'invalidStartDate' };
  const startTime = parseLocalCivilTime(values.startTime);
  if (!startTime) return { success: false, issue: 'invalidStartTime' };
  const endDate = parseLocalCivilDate(values.endDate);
  if (!endDate) return { success: false, issue: 'invalidEndDate' };
  const endTime = parseLocalCivilTime(values.endTime);
  if (!endTime) return { success: false, issue: 'invalidEndTime' };
  return createCustomObservingWindow({
    timeZoneId: values.timeZoneId,
    start: { ...startDate, ...startTime },
    end: { ...endDate, ...endTime },
    startAmbiguity: values.startAmbiguity,
    endAmbiguity: values.endAmbiguity,
  });
};
