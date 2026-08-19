import {
  EquatorFromVector,
  Horizon,
  Observer,
  Refraction,
  RotateVector,
  Rotation_EQJ_EQD,
  SiderealTime,
  Spherical,
  VectorFromSphere,
} from 'astronomy-engine';

export type ObserverLocation = {
  latitudeDegreesNorth: number;
  longitudeDegreesEast: number;
  elevationMetersAboveMeanSeaLevel: number;
};

export type EquatorialJ2000Input = {
  rightAscensionJ2000Hours: number;
  declinationJ2000Degrees: number;
  timestampUtc: string;
  observer: ObserverLocation;
};

export type HorizontalCoordinates = {
  azimuthDegreesClockwiseFromNorth: number;
  refractedAltitudeDegrees: number;
};

export type HorizontalProjectionWindow = Readonly<{
  startTimestampUtc: string;
  endTimestampUtc: string;
}>;

const assertFiniteRange = (
  value: number,
  name: string,
  minimum: number,
  maximum: number,
  maximumInclusive = true,
) => {
  const exceedsMaximum = maximumInclusive ? value > maximum : value >= maximum;
  if (!Number.isFinite(value) || value < minimum || exceedsMaximum) {
    throw new RangeError(
      `${name} must be ${minimum}..${maximum}${maximumInclusive ? '' : ' (exclusive)'}`,
    );
  }
};

const parseUtcInstant = (timestampUtc: string) => {
  const date = new Date(timestampUtc);
  if (!timestampUtc.endsWith('Z') || Number.isNaN(date.getTime())) {
    throw new TypeError('timestampUtc must be a valid ISO-8601 UTC instant');
  }
  return date;
};

/**
 * Converts fixed ICRS/J2000 catalogue coordinates into the app horizontal frame.
 *
 * Astronomy Engine's `Horizon` expects equatorial-of-date coordinates, so this
 * adapter explicitly precesses the catalogue vector from EQJ to EQD first. The
 * returned azimuth is clockwise from true north and `normal` optical refraction
 * is applied consistently to altitude.
 */
export const equatorialJ2000ToHorizontal = (
  input: EquatorialJ2000Input,
): HorizontalCoordinates => {
  assertFiniteRange(
    input.rightAscensionJ2000Hours,
    'rightAscensionJ2000Hours',
    0,
    24,
    false,
  );
  assertFiniteRange(
    input.declinationJ2000Degrees,
    'declinationJ2000Degrees',
    -90,
    90,
  );
  assertFiniteRange(
    input.observer.latitudeDegreesNorth,
    'latitudeDegreesNorth',
    -90,
    90,
  );
  assertFiniteRange(
    input.observer.longitudeDegreesEast,
    'longitudeDegreesEast',
    -180,
    180,
  );
  if (!Number.isFinite(input.observer.elevationMetersAboveMeanSeaLevel)) {
    throw new RangeError('elevationMetersAboveMeanSeaLevel must be finite');
  }

  const date = parseUtcInstant(input.timestampUtc);
  const j2000Vector = VectorFromSphere(
    new Spherical(
      input.declinationJ2000Degrees,
      input.rightAscensionJ2000Hours * 15,
      1,
    ),
    date,
  );
  const equatorialOfDate = EquatorFromVector(
    RotateVector(Rotation_EQJ_EQD(date), j2000Vector),
  );
  const observer = new Observer(
    input.observer.latitudeDegreesNorth,
    input.observer.longitudeDegreesEast,
    input.observer.elevationMetersAboveMeanSeaLevel,
  );
  const horizontal = Horizon(
    date,
    observer,
    equatorialOfDate.ra,
    equatorialOfDate.dec,
    'normal',
  );

  return {
    azimuthDegreesClockwiseFromNorth: horizontal.azimuth,
    refractedAltitudeDegrees: horizontal.altitude,
  };
};

const SIDEREAL_HOURS_PER_UTC_DAY = 24.06570982441908;

/**
 * Creates a fast projector for repeated samples of one fixed catalogue target
 * over a window no longer than 24 hours. Precession/nutation is evaluated at
 * the window midpoint, then Earth rotation is advanced at the sidereal rate.
 * The approximation is fixture-tested against the authoritative adapter and
 * retains Astronomy Engine's normal-refraction model.
 */
const createWindowHorizontalProjectorAtMillisecondsInternal = (input: {
  observer: ObserverLocation;
  target: Pick<
    EquatorialJ2000Input,
    'rightAscensionJ2000Hours' | 'declinationJ2000Degrees'
  >;
  window: HorizontalProjectionWindow;
}): ((timestampMilliseconds: number) => HorizontalCoordinates) => {
  const startDate = parseUtcInstant(input.window.startTimestampUtc);
  const endDate = parseUtcInstant(input.window.endTimestampUtc);
  const durationMilliseconds = endDate.getTime() - startDate.getTime();
  if (durationMilliseconds <= 0 || durationMilliseconds > 24 * 60 * 60 * 1000) {
    throw new RangeError(
      'Horizontal projection window must be greater than 0 and at most 24 hours.',
    );
  }
  assertFiniteRange(
    input.target.rightAscensionJ2000Hours,
    'rightAscensionJ2000Hours',
    0,
    24,
    false,
  );
  assertFiniteRange(
    input.target.declinationJ2000Degrees,
    'declinationJ2000Degrees',
    -90,
    90,
  );
  assertFiniteRange(
    input.observer.latitudeDegreesNorth,
    'latitudeDegreesNorth',
    -90,
    90,
  );
  assertFiniteRange(
    input.observer.longitudeDegreesEast,
    'longitudeDegreesEast',
    -180,
    180,
  );
  const midpointDate = new Date(startDate.getTime() + durationMilliseconds / 2);
  const equatorialOfDate = EquatorFromVector(
    RotateVector(
      Rotation_EQJ_EQD(midpointDate),
      VectorFromSphere(
        new Spherical(
          input.target.declinationJ2000Degrees,
          input.target.rightAscensionJ2000Hours * 15,
          1,
        ),
        midpointDate,
      ),
    ),
  );
  const referenceTimestampMilliseconds = midpointDate.getTime();
  const referenceSiderealHours = SiderealTime(midpointDate);
  const degreesToRadians = Math.PI / 180;
  const radiansToDegrees = 180 / Math.PI;
  const latitudeRadians =
    input.observer.latitudeDegreesNorth * degreesToRadians;
  const declinationRadians = equatorialOfDate.dec * degreesToRadians;
  const sinLatitude = Math.sin(latitudeRadians);
  const cosLatitude = Math.cos(latitudeRadians);
  const sinDeclination = Math.sin(declinationRadians);
  const cosDeclination = Math.cos(declinationRadians);
  const tanDeclination = Math.tan(declinationRadians);

  return (timestampMilliseconds) => {
    if (!Number.isFinite(timestampMilliseconds)) {
      throw new TypeError('timestampMilliseconds must be finite.');
    }
    const elapsedUtcDays =
      (timestampMilliseconds - referenceTimestampMilliseconds) /
      (24 * 60 * 60 * 1000);
    const localSiderealHours =
      referenceSiderealHours +
      elapsedUtcDays * SIDEREAL_HOURS_PER_UTC_DAY +
      input.observer.longitudeDegreesEast / 15;
    const hourAngleRadians =
      (localSiderealHours - equatorialOfDate.ra) * 15 * degreesToRadians;
    const sinAltitude =
      sinLatitude * sinDeclination +
      cosLatitude * cosDeclination * Math.cos(hourAngleRadians);
    const geometricAltitudeDegrees =
      Math.asin(Math.max(-1, Math.min(1, sinAltitude))) * radiansToDegrees;
    const azimuthDegrees =
      Math.atan2(
        Math.sin(hourAngleRadians),
        Math.cos(hourAngleRadians) * sinLatitude - tanDeclination * cosLatitude,
      ) *
        radiansToDegrees +
      180;
    return {
      azimuthDegreesClockwiseFromNorth: ((azimuthDegrees % 360) + 360) % 360,
      refractedAltitudeDegrees:
        geometricAltitudeDegrees +
        Refraction('normal', geometricAltitudeDegrees),
    };
  };
};

export const createWindowHorizontalProjectorAtMilliseconds = (input: {
  observer: ObserverLocation;
  target: Pick<
    EquatorialJ2000Input,
    'rightAscensionJ2000Hours' | 'declinationJ2000Degrees'
  >;
  window: HorizontalProjectionWindow;
}) => createWindowHorizontalProjectorAtMillisecondsInternal(input);

export const createWindowHorizontalProjector = (input: {
  observer: ObserverLocation;
  target: Pick<
    EquatorialJ2000Input,
    'rightAscensionJ2000Hours' | 'declinationJ2000Degrees'
  >;
  window: HorizontalProjectionWindow;
}): ((timestampUtc: string) => HorizontalCoordinates) => {
  const projectAtMilliseconds =
    createWindowHorizontalProjectorAtMillisecondsInternal(input);
  return (timestampUtc) =>
    projectAtMilliseconds(parseUtcInstant(timestampUtc).getTime());
};
