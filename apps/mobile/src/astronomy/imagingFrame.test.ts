import { createImagingFrame } from './imagingFrame';

const input = {
  horizontal: {
    azimuthDegreesClockwiseFromNorth: 0,
    refractedAltitudeDegrees: 45,
  },
  observerLatitudeDegrees: 42,
  horizontalFovDegrees: 4,
  verticalFovDegrees: 2,
  orientationDegrees: 0,
  trackingMode: 'altaz' as const,
};

const separation = (a: { x: number; y: number; z: number }, b: typeof a) =>
  (Math.acos(Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z))) *
    180) /
  Math.PI;

describe('physical imaging frame', () => {
  it('matches the independent celestial-pole tangent at the equator', () => {
    const frame = createImagingFrame({
      ...input,
      trackingMode: 'equatorial',
      observerLatitudeDegrees: 0,
      horizontal: {
        azimuthDegreesClockwiseFromNorth: 90,
        refractedAltitudeDegrees: 45,
      },
    });
    // At geographic latitude 0 the north celestial pole is due north on the
    // horizon. At due east its projection is already perpendicular to the ray.
    expect(frame.up.z).toBeCloseTo(1, 6);
    expect(frame.up.x).toBeCloseTo(0, 4);
    expect(frame.up.y).toBeCloseTo(0, 4);
  });

  it.each([-90, 0, 90])(
    'keeps celestial framing finite at latitude %s',
    (latitude) => {
      const frame = createImagingFrame({
        ...input,
        trackingMode: 'equatorial',
        observerLatitudeDegrees: latitude,
        horizontal: {
          azimuthDegreesClockwiseFromNorth: 0,
          refractedAltitudeDegrees: 90,
        },
      });
      expect(
        frame.corners
          .flatMap(({ x, y, z }) => [x, y, z])
          .every(Number.isFinite),
      ).toBe(true);
    },
  );

  it('uses optical angular width and height, independent of a viewport', () => {
    const frame = createImagingFrame(input);
    expect(separation(frame.corners[0]!, frame.corners[1]!)).toBeCloseTo(
      3.9994,
      3,
    );
    expect(frame.corners.every((corner) => corner.y > 0)).toBe(true);
    expect(
      frame.planes.every(
        (plane) =>
          plane.x * frame.center.x +
            plane.y * frame.center.y +
            plane.z * frame.center.z >
          0,
      ),
    ).toBe(true);
  });

  it('rotates a nonsquare footprint around its pointing direction', () => {
    const initial = createImagingFrame(input);
    const rotated = createImagingFrame({ ...input, orientationDegrees: 90 });
    expect(separation(initial.up, rotated.right)).toBeCloseTo(180, 5);
    expect(rotated.center).toEqual(initial.center);
  });

  it('uses the same celestial orientation for EQ and active derotation', () => {
    const eq = createImagingFrame({ ...input, trackingMode: 'equatorial' });
    const derotated = createImagingFrame({
      ...input,
      trackingMode: 'derotatedAltaz',
    });
    expect(derotated).toEqual(eq);
    const east = {
      ...input,
      horizontal: {
        azimuthDegreesClockwiseFromNorth: 90,
        refractedAltitudeDegrees: 30,
      },
    };
    expect(
      separation(
        createImagingFrame(east).up,
        createImagingFrame({ ...east, trackingMode: 'equatorial' }).up,
      ),
    ).toBeGreaterThan(30);
  });

  it.each([0, 90, 180, 359.999])(
    'remains finite at zenith with azimuth %s',
    (azimuth) => {
      const frame = createImagingFrame({
        ...input,
        horizontal: {
          azimuthDegreesClockwiseFromNorth: azimuth,
          refractedAltitudeDegrees: 90,
        },
      });
      expect(
        frame.corners
          .flatMap(({ x, y, z }) => [x, y, z])
          .every(Number.isFinite),
      ).toBe(true);
    },
  );

  it.each([0, 180, Infinity, NaN])(
    'rejects invalid optical FOV %s',
    (width) => {
      expect(() =>
        createImagingFrame({ ...input, horizontalFovDegrees: width }),
      ).toThrow();
    },
  );
});
