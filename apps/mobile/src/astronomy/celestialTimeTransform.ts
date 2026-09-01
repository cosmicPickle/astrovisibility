import { Rotation_EQJ_EQD, SiderealTime } from 'astronomy-engine';

import type {
  HorizontalProjectionWindow,
  ObserverLocation,
} from './horizontalCoordinates';

export type UnitVector3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type CelestialTimeTransform = Readonly<{
  cosObserverLatitude: number;
  endTimestampMilliseconds: number;
  j2000ToEquatorialOfDate: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  referenceLocalSiderealHours: number;
  referenceTimestampMilliseconds: number;
  sinObserverLatitude: number;
  startTimestampMilliseconds: number;
}>;

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const SIDEREAL_HOURS_PER_UTC_DAY = 24.06570982441908;
const MILLISECONDS_PER_UTC_DAY = 24 * 60 * 60 * 1000;
const MAXIMUM_WINDOW_MILLISECONDS = 25 * 60 * 60 * 1000;
const UNIT_VECTOR_EPSILON = 1e-12;

const parseUtcInstant = (timestampUtc: string) => {
  const date = new Date(timestampUtc);
  if (!timestampUtc.endsWith('Z') || Number.isNaN(date.getTime())) {
    throw new TypeError('timestampUtc must be a valid ISO-8601 UTC instant');
  }
  return date;
};

const assertObserver = (observer: ObserverLocation) => {
  if (
    !Number.isFinite(observer.latitudeDegreesNorth) ||
    observer.latitudeDegreesNorth < -90 ||
    observer.latitudeDegreesNorth > 90
  ) {
    throw new RangeError('latitudeDegreesNorth must be -90..90');
  }
  if (
    !Number.isFinite(observer.longitudeDegreesEast) ||
    observer.longitudeDegreesEast < -180 ||
    observer.longitudeDegreesEast > 180
  ) {
    throw new RangeError('longitudeDegreesEast must be -180..180');
  }
  if (!Number.isFinite(observer.elevationMetersAboveMeanSeaLevel)) {
    throw new RangeError('elevationMetersAboveMeanSeaLevel must be finite');
  }
};

const normalizeUnitVector = (vector: UnitVector3): UnitVector3 => {
  'worklet';
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(magnitude) || magnitude < UNIT_VECTOR_EPSILON) {
    throw new RangeError('Unit vector must be finite and non-zero');
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
};

const normalRefractionDegrees = (geometricAltitudeDegrees: number) => {
  'worklet';
  if (geometricAltitudeDegrees < -90 || geometricAltitudeDegrees > 90) {
    return 0;
  }
  const boundedAltitudeDegrees = Math.max(-1, geometricAltitudeDegrees);
  let refractionDegrees =
    1.02 /
    Math.tan(
      (boundedAltitudeDegrees + 10.3 / (boundedAltitudeDegrees + 5.11)) *
        DEGREES_TO_RADIANS,
    ) /
    60;
  if (geometricAltitudeDegrees < -1) {
    refractionDegrees *= (geometricAltitudeDegrees + 90) / 89;
  }
  return refractionDegrees;
};

const geometricAltitudeFromObservedDegrees = (
  observedAltitudeDegrees: number,
) => {
  'worklet';
  let geometricAltitudeDegrees =
    observedAltitudeDegrees - normalRefractionDegrees(observedAltitudeDegrees);
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const differenceDegrees =
      geometricAltitudeDegrees +
      normalRefractionDegrees(geometricAltitudeDegrees) -
      observedAltitudeDegrees;
    geometricAltitudeDegrees -= differenceDegrees;
    if (Math.abs(differenceDegrees) < 1e-12) break;
  }
  return geometricAltitudeDegrees;
};

const assertTimestampInWindow = (
  timestampMilliseconds: number,
  transform: CelestialTimeTransform,
) => {
  'worklet';
  if (
    !Number.isFinite(timestampMilliseconds) ||
    timestampMilliseconds < transform.startTimestampMilliseconds ||
    timestampMilliseconds > transform.endTimestampMilliseconds
  ) {
    throw new RangeError('Timestamp must be inside the observing window');
  }
};

const equatorialOfDateVector = (
  j2000Vector: UnitVector3,
  transform: CelestialTimeTransform,
) => {
  'worklet';
  const matrix = transform.j2000ToEquatorialOfDate;
  return {
    x:
      matrix[0] * j2000Vector.x +
      matrix[1] * j2000Vector.y +
      matrix[2] * j2000Vector.z,
    y:
      matrix[3] * j2000Vector.x +
      matrix[4] * j2000Vector.y +
      matrix[5] * j2000Vector.z,
    z:
      matrix[6] * j2000Vector.x +
      matrix[7] * j2000Vector.y +
      matrix[8] * j2000Vector.z,
  };
};

const localSiderealRadiansAt = (
  transform: CelestialTimeTransform,
  timestampMilliseconds: number,
) => {
  'worklet';
  const elapsedUtcDays =
    (timestampMilliseconds - transform.referenceTimestampMilliseconds) /
    MILLISECONDS_PER_UTC_DAY;
  return (
    (transform.referenceLocalSiderealHours +
      elapsedUtcDays * SIDEREAL_HOURS_PER_UTC_DAY) *
    15 *
    DEGREES_TO_RADIANS
  );
};

export const equatorialJ2000ToUnitVector = (coordinate: {
  declinationJ2000Degrees: number;
  rightAscensionJ2000Hours: number;
}): UnitVector3 => {
  if (
    !Number.isFinite(coordinate.rightAscensionJ2000Hours) ||
    coordinate.rightAscensionJ2000Hours < 0 ||
    coordinate.rightAscensionJ2000Hours >= 24
  ) {
    throw new RangeError('rightAscensionJ2000Hours must be 0..24 (exclusive)');
  }
  if (
    !Number.isFinite(coordinate.declinationJ2000Degrees) ||
    coordinate.declinationJ2000Degrees < -90 ||
    coordinate.declinationJ2000Degrees > 90
  ) {
    throw new RangeError('declinationJ2000Degrees must be -90..90');
  }
  const rightAscensionRadians =
    coordinate.rightAscensionJ2000Hours * 15 * DEGREES_TO_RADIANS;
  const declinationRadians =
    coordinate.declinationJ2000Degrees * DEGREES_TO_RADIANS;
  const equatorialRadius = Math.cos(declinationRadians);
  return {
    x: equatorialRadius * Math.cos(rightAscensionRadians),
    y: equatorialRadius * Math.sin(rightAscensionRadians),
    z: Math.sin(declinationRadians),
  };
};

export const createCelestialTimeTransform = (input: {
  observer: ObserverLocation;
  window: HorizontalProjectionWindow;
}): CelestialTimeTransform => {
  assertObserver(input.observer);
  const startDate = parseUtcInstant(input.window.startTimestampUtc);
  const endDate = parseUtcInstant(input.window.endTimestampUtc);
  const durationMilliseconds = endDate.getTime() - startDate.getTime();
  if (
    durationMilliseconds <= 0 ||
    durationMilliseconds > MAXIMUM_WINDOW_MILLISECONDS
  ) {
    throw new RangeError(
      'Celestial time transform window must be greater than 0 and at most 25 hours',
    );
  }
  const referenceDate = new Date(
    startDate.getTime() + durationMilliseconds / 2,
  );
  const rotation = Rotation_EQJ_EQD(referenceDate).rot;
  const observerLatitudeRadians =
    input.observer.latitudeDegreesNorth * DEGREES_TO_RADIANS;
  return {
    cosObserverLatitude: Math.cos(observerLatitudeRadians),
    endTimestampMilliseconds: endDate.getTime(),
    j2000ToEquatorialOfDate: [
      rotation[0]![0]!,
      rotation[1]![0]!,
      rotation[2]![0]!,
      rotation[0]![1]!,
      rotation[1]![1]!,
      rotation[2]![1]!,
      rotation[0]![2]!,
      rotation[1]![2]!,
      rotation[2]![2]!,
    ],
    referenceLocalSiderealHours:
      SiderealTime(referenceDate) + input.observer.longitudeDegreesEast / 15,
    referenceTimestampMilliseconds: referenceDate.getTime(),
    sinObserverLatitude: Math.sin(observerLatitudeRadians),
    startTimestampMilliseconds: startDate.getTime(),
  };
};

export const projectJ2000ToObservedHorizontalVector = (
  rawJ2000Vector: UnitVector3,
  transform: CelestialTimeTransform,
  timestampMilliseconds: number,
): UnitVector3 => {
  'worklet';
  assertTimestampInWindow(timestampMilliseconds, transform);
  const j2000Vector = normalizeUnitVector(rawJ2000Vector);
  const equatorial = equatorialOfDateVector(j2000Vector, transform);
  const siderealRadians = localSiderealRadiansAt(
    transform,
    timestampMilliseconds,
  );
  const sinSidereal = Math.sin(siderealRadians);
  const cosSidereal = Math.cos(siderealRadians);
  const meridianComponent =
    cosSidereal * equatorial.x + sinSidereal * equatorial.y;
  const geometricEast =
    -sinSidereal * equatorial.x + cosSidereal * equatorial.y;
  const geometricUp =
    transform.cosObserverLatitude * meridianComponent +
    transform.sinObserverLatitude * equatorial.z;
  const geometricNorth =
    -transform.sinObserverLatitude * meridianComponent +
    transform.cosObserverLatitude * equatorial.z;
  const geometricAltitudeDegrees =
    Math.asin(Math.max(-1, Math.min(1, geometricUp))) * RADIANS_TO_DEGREES;
  const observedAltitudeRadians =
    (geometricAltitudeDegrees +
      normalRefractionDegrees(geometricAltitudeDegrees)) *
    DEGREES_TO_RADIANS;
  const geometricHorizontalRadius = Math.hypot(geometricEast, geometricNorth);
  if (geometricHorizontalRadius < UNIT_VECTOR_EPSILON) {
    return { x: 0, y: Math.sin(observedAltitudeRadians), z: 0 };
  }
  const observedHorizontalScale =
    Math.cos(observedAltitudeRadians) / geometricHorizontalRadius;
  return normalizeUnitVector({
    x: geometricEast * observedHorizontalScale,
    y: Math.sin(observedAltitudeRadians),
    z: geometricNorth * observedHorizontalScale,
  });
};

export const observedHorizontalVectorToJ2000 = (
  rawObservedVector: UnitVector3,
  transform: CelestialTimeTransform,
  timestampMilliseconds: number,
): UnitVector3 => {
  'worklet';
  assertTimestampInWindow(timestampMilliseconds, transform);
  const observed = normalizeUnitVector(rawObservedVector);
  const observedAltitudeDegrees =
    Math.asin(Math.max(-1, Math.min(1, observed.y))) * RADIANS_TO_DEGREES;
  const geometricAltitudeRadians =
    geometricAltitudeFromObservedDegrees(observedAltitudeDegrees) *
    DEGREES_TO_RADIANS;
  const observedHorizontalRadius = Math.hypot(observed.x, observed.z);
  const geometricHorizontalRadius = Math.cos(geometricAltitudeRadians);
  const geometricEast =
    observedHorizontalRadius < UNIT_VECTOR_EPSILON
      ? 0
      : (observed.x / observedHorizontalRadius) * geometricHorizontalRadius;
  const geometricNorth =
    observedHorizontalRadius < UNIT_VECTOR_EPSILON
      ? 0
      : (observed.z / observedHorizontalRadius) * geometricHorizontalRadius;
  const geometricUp = Math.sin(geometricAltitudeRadians);
  const meridianComponent =
    transform.cosObserverLatitude * geometricUp -
    transform.sinObserverLatitude * geometricNorth;
  const equatorialZ =
    transform.sinObserverLatitude * geometricUp +
    transform.cosObserverLatitude * geometricNorth;
  const siderealRadians = localSiderealRadiansAt(
    transform,
    timestampMilliseconds,
  );
  const sinSidereal = Math.sin(siderealRadians);
  const cosSidereal = Math.cos(siderealRadians);
  const equatorialX =
    cosSidereal * meridianComponent - sinSidereal * geometricEast;
  const equatorialY =
    sinSidereal * meridianComponent + cosSidereal * geometricEast;
  const matrix = transform.j2000ToEquatorialOfDate;
  return normalizeUnitVector({
    x:
      matrix[0] * equatorialX +
      matrix[3] * equatorialY +
      matrix[6] * equatorialZ,
    y:
      matrix[1] * equatorialX +
      matrix[4] * equatorialY +
      matrix[7] * equatorialZ,
    z:
      matrix[2] * equatorialX +
      matrix[5] * equatorialY +
      matrix[8] * equatorialZ,
  });
};
