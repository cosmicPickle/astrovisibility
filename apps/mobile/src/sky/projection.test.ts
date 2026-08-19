import {
  projectHorizontalToCanvas,
  unwrapAzimuthDegreesNear,
} from './projection';

describe('equirectangular horizontal projection', () => {
  it('maps north/horizon and zenith with explicit units', () => {
    expect(
      projectHorizontalToCanvas(
        { azimuthDegrees: 0, altitudeDegrees: 0 },
        { widthPixels: 3600, heightPixels: 900 },
      ),
    ).toEqual({ xPixels: 0, yPixels: 900 });
    expect(
      projectHorizontalToCanvas(
        { azimuthDegrees: 180, altitudeDegrees: 90 },
        { widthPixels: 3600, heightPixels: 900 },
      ),
    ).toEqual({ xPixels: 1800, yPixels: 0 });
  });

  it('unwraps north-crossing azimuths near their reference', () => {
    expect(unwrapAzimuthDegreesNear(2, 358)).toBe(362);
    expect(unwrapAzimuthDegreesNear(358, 2)).toBe(-2);
  });
});
