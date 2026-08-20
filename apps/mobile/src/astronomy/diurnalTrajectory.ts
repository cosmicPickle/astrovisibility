import {
  createWindowHorizontalProjectorAtMilliseconds,
  type EquatorialJ2000Input,
  type HorizontalCoordinates,
  type ObserverLocation,
} from './horizontalCoordinates';

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_UTC_DAY = 24 * 60 * 60 * 1000;
// IAU-compatible mean sidereal rotation used by the existing fast horizontal
// projector: 24.06570982441908 sidereal hours per UTC day.
export const SIDEREAL_ROTATION_MILLISECONDS =
  (MILLISECONDS_PER_UTC_DAY * 24) / 24.06570982441908;

export type DiurnalOrbitSample = HorizontalCoordinates &
  Readonly<{ timestampUtc: string }>;

export type TargetDiurnalOrbit = Readonly<{
  samples: readonly DiurnalOrbitSample[];
}>;

export const createTargetDiurnalOrbit = (input: {
  anchorTimestampUtc: string;
  observer: ObserverLocation;
  target: Pick<
    EquatorialJ2000Input,
    'rightAscensionJ2000Hours' | 'declinationJ2000Degrees'
  >;
}): TargetDiurnalOrbit => {
  const startMilliseconds = Date.parse(input.anchorTimestampUtc);
  if (
    !input.anchorTimestampUtc.endsWith('Z') ||
    Number.isNaN(startMilliseconds)
  ) {
    throw new TypeError('anchorTimestampUtc must be a valid UTC instant');
  }
  const endMilliseconds = startMilliseconds + SIDEREAL_ROTATION_MILLISECONDS;
  const projectAtMilliseconds = createWindowHorizontalProjectorAtMilliseconds({
    observer: input.observer,
    target: input.target,
    window: {
      startTimestampUtc: input.anchorTimestampUtc,
      endTimestampUtc: new Date(endMilliseconds).toISOString(),
    },
  });
  const samples: DiurnalOrbitSample[] = [];
  for (
    let timestampMilliseconds = startMilliseconds;
    timestampMilliseconds < endMilliseconds;
    timestampMilliseconds += MILLISECONDS_PER_MINUTE
  ) {
    samples.push({
      ...projectAtMilliseconds(timestampMilliseconds),
      timestampUtc: new Date(timestampMilliseconds).toISOString(),
    });
  }
  samples.push({
    ...projectAtMilliseconds(endMilliseconds),
    timestampUtc: new Date(endMilliseconds).toISOString(),
  });
  return { samples };
};
