export interface LocalCivilDate {
  year: number;
  month: number;
  day: number;
}

export interface LocalCivilDateTime extends LocalCivilDate {
  hour: number;
  minute: number;
}

export type LocalCivilTimeResolution =
  | { kind: 'unique'; timestampUtc: string }
  | {
      kind: 'ambiguous';
      earlierTimestampUtc: string;
      laterTimestampUtc: string;
    }
  | { kind: 'gap' };

export type AmbiguousTimeChoice = 'earlier' | 'later';

export interface ObservingWindow {
  kind:
    | 'astronomicalDarkness'
    | 'sunsetSunrise'
    | 'civilFallback'
    | 'custom'
    | 'day';
  startTimestampUtc: string;
  endTimestampUtc: string;
  note: string | null;
  warnings: readonly string[];
}

export type CustomObservingWindowResult =
  | { success: true; window: ObservingWindow }
  | {
      success: false;
      issue:
        | 'startGap'
        | 'endGap'
        | 'startAmbiguous'
        | 'endAmbiguous'
        | 'endNotAfterStart'
        | 'durationExceeds24Hours';
      candidatesUtc?: readonly string[];
    };

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
const MAXIMUM_WINDOW_MILLISECONDS = 24 * MILLISECONDS_PER_HOUR;
const zonedFormatters = new Map<string, Intl.DateTimeFormat>();

const getZonedFormatter = (timeZoneId: string): Intl.DateTimeFormat => {
  const existing = zonedFormatters.get(timeZoneId);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: timeZoneId,
  });
  zonedFormatters.set(timeZoneId, formatter);
  return formatter;
};

const partsFromInstant = (
  timestampMilliseconds: number,
  timeZoneId: string,
): LocalCivilDateTime & { second: number } => {
  const values = Object.fromEntries(
    getZonedFormatter(timeZoneId)
      .formatToParts(new Date(timestampMilliseconds))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
  return values;
};

const assertValidLocalDateTime = (local: LocalCivilDateTime): void => {
  for (const [name, value] of Object.entries(local)) {
    if (!Number.isInteger(value)) {
      throw new RangeError(`${name} must be an integer`);
    }
  }
  const normalized = new Date(
    Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute),
  );
  if (
    normalized.getUTCFullYear() !== local.year ||
    normalized.getUTCMonth() + 1 !== local.month ||
    normalized.getUTCDate() !== local.day ||
    normalized.getUTCHours() !== local.hour ||
    normalized.getUTCMinutes() !== local.minute
  ) {
    throw new RangeError('Invalid local civil date/time');
  }
};

const partsEqual = (
  actual: LocalCivilDateTime & { second: number },
  desired: LocalCivilDateTime,
) =>
  actual.year === desired.year &&
  actual.month === desired.month &&
  actual.day === desired.day &&
  actual.hour === desired.hour &&
  actual.minute === desired.minute &&
  actual.second === 0;

/**
 * Resolves a wall-clock minute without silently normalizing a DST gap or choosing
 * one occurrence of a repeated time. Offset candidates are discovered around the
 * requested date, then every candidate is round-tripped through the IANA zone.
 */
export const resolveLocalCivilDateTime = (
  local: LocalCivilDateTime,
  timeZoneId: string,
): LocalCivilTimeResolution => {
  assertValidLocalDateTime(local);
  const desiredUtcMilliseconds = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  const possibleOffsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sampleMilliseconds =
      desiredUtcMilliseconds + hours * MILLISECONDS_PER_HOUR;
    const sampleParts = partsFromInstant(sampleMilliseconds, timeZoneId);
    const representedAsUtc = Date.UTC(
      sampleParts.year,
      sampleParts.month - 1,
      sampleParts.day,
      sampleParts.hour,
      sampleParts.minute,
      sampleParts.second,
    );
    possibleOffsets.add(representedAsUtc - sampleMilliseconds);
  }

  const candidates = [...possibleOffsets]
    .map((offset) => desiredUtcMilliseconds - offset)
    .filter((candidate) =>
      partsEqual(partsFromInstant(candidate, timeZoneId), local),
    )
    .sort((left, right) => left - right)
    .filter(
      (candidate, index, all) => index === 0 || candidate !== all[index - 1],
    );

  if (candidates.length === 0) return { kind: 'gap' };
  if (candidates.length === 1) {
    return {
      kind: 'unique',
      timestampUtc: new Date(candidates[0]!).toISOString(),
    };
  }
  return {
    kind: 'ambiguous',
    earlierTimestampUtc: new Date(candidates[0]!).toISOString(),
    laterTimestampUtc: new Date(
      candidates[candidates.length - 1]!,
    ).toISOString(),
  };
};

export const localCivilDateTimeAtInstant = (
  timestampUtc: string,
  timeZoneId: string,
): LocalCivilDateTime => {
  const timestampMilliseconds = Date.parse(timestampUtc);
  if (!timestampUtc.endsWith('Z') || Number.isNaN(timestampMilliseconds)) {
    throw new TypeError('timestampUtc must be a valid ISO-8601 UTC instant');
  }
  const { year, month, day, hour, minute } = partsFromInstant(
    timestampMilliseconds,
    timeZoneId,
  );
  return { year, month, day, hour, minute };
};

export const addDaysToLocalDate = (
  localDate: LocalCivilDate,
  days: number,
): LocalCivilDate => {
  if (!Number.isInteger(days)) throw new RangeError('days must be an integer');
  const source = new Date(
    Date.UTC(localDate.year, localDate.month - 1, localDate.day),
  );
  if (
    !Number.isInteger(localDate.year) ||
    !Number.isInteger(localDate.month) ||
    !Number.isInteger(localDate.day) ||
    source.getUTCFullYear() !== localDate.year ||
    source.getUTCMonth() + 1 !== localDate.month ||
    source.getUTCDate() !== localDate.day
  ) {
    throw new RangeError('Invalid local civil date');
  }
  const result = new Date(
    Date.UTC(localDate.year, localDate.month - 1, localDate.day + days),
  );
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
};

export const selectResolvedTimestampUtc = (
  resolution: LocalCivilTimeResolution,
  ambiguity: AmbiguousTimeChoice | undefined,
): string | null => {
  if (resolution.kind === 'gap') return null;
  if (resolution.kind === 'unique') return resolution.timestampUtc;
  if (!ambiguity) return null;
  return ambiguity === 'earlier'
    ? resolution.earlierTimestampUtc
    : resolution.laterTimestampUtc;
};

export const createCustomObservingWindow = (input: {
  timeZoneId: string;
  start: LocalCivilDateTime;
  end: LocalCivilDateTime;
  startAmbiguity?: AmbiguousTimeChoice;
  endAmbiguity?: AmbiguousTimeChoice;
}): CustomObservingWindowResult => {
  const startResolution = resolveLocalCivilDateTime(
    input.start,
    input.timeZoneId,
  );
  if (startResolution.kind === 'gap') {
    return { success: false, issue: 'startGap' };
  }
  if (startResolution.kind === 'ambiguous' && !input.startAmbiguity) {
    return {
      success: false,
      issue: 'startAmbiguous',
      candidatesUtc: [
        startResolution.earlierTimestampUtc,
        startResolution.laterTimestampUtc,
      ],
    };
  }
  const endResolution = resolveLocalCivilDateTime(input.end, input.timeZoneId);
  if (endResolution.kind === 'gap') {
    return { success: false, issue: 'endGap' };
  }
  if (endResolution.kind === 'ambiguous' && !input.endAmbiguity) {
    return {
      success: false,
      issue: 'endAmbiguous',
      candidatesUtc: [
        endResolution.earlierTimestampUtc,
        endResolution.laterTimestampUtc,
      ],
    };
  }

  const startTimestampUtc = selectResolvedTimestampUtc(
    startResolution,
    input.startAmbiguity,
  )!;
  const endTimestampUtc = selectResolvedTimestampUtc(
    endResolution,
    input.endAmbiguity,
  )!;
  const durationMilliseconds =
    Date.parse(endTimestampUtc) - Date.parse(startTimestampUtc);
  if (durationMilliseconds <= 0) {
    return { success: false, issue: 'endNotAfterStart' };
  }
  if (durationMilliseconds > MAXIMUM_WINDOW_MILLISECONDS) {
    return { success: false, issue: 'durationExceeds24Hours' };
  }
  return {
    success: true,
    window: {
      kind: 'custom',
      startTimestampUtc,
      endTimestampUtc,
      note: null,
      warnings: [],
    },
  };
};
