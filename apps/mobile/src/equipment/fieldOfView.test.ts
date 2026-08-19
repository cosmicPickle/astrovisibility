import {
  calculateAngularFieldOfView,
  createRotatedFieldOfViewRectangle,
} from './fieldOfView';

describe('field-of-view geometry', () => {
  it('calculates the exact sensor angular field from focal length', () => {
    expect(
      calculateAngularFieldOfView({
        focalLengthMillimeters: 400,
        sensorWidthMillimeters: 23.5,
        sensorHeightMillimeters: 15.6,
      }),
    ).toEqual({
      horizontalFovDegrees: expect.closeTo(3.365, 3),
      verticalFovDegrees: expect.closeTo(2.234, 3),
    });
  });

  it('returns a centered angular rectangle rotated by the saved frame rotation', () => {
    const rectangle = createRotatedFieldOfViewRectangle({
      focalLengthMillimeters: 400,
      sensorWidthMillimeters: 23.5,
      sensorHeightMillimeters: 15.6,
      frameRotationDegrees: 90,
    });

    expect(rectangle.rotationDegrees).toBe(90);
    expect(rectangle.corners).toHaveLength(4);
    expect(
      Math.max(
        ...rectangle.corners.map((corner) =>
          Math.abs(corner.horizontalOffsetDegrees),
        ),
      ),
    ).toBeCloseTo(rectangle.verticalFovDegrees / 2, 10);
    expect(
      Math.max(
        ...rectangle.corners.map((corner) =>
          Math.abs(corner.verticalOffsetDegrees),
        ),
      ),
    ).toBeCloseTo(rectangle.horizontalFovDegrees / 2, 10);
    expect(
      rectangle.corners.reduce(
        (sum, corner) => sum + corner.horizontalOffsetDegrees,
        0,
      ),
    ).toBeCloseTo(0, 12);
    expect(
      rectangle.corners.reduce(
        (sum, corner) => sum + corner.verticalOffsetDegrees,
        0,
      ),
    ).toBeCloseTo(0, 12);
  });

  it('rejects non-physical optical dimensions', () => {
    expect(() =>
      calculateAngularFieldOfView({
        focalLengthMillimeters: 0,
        sensorWidthMillimeters: 23.5,
        sensorHeightMillimeters: 15.6,
      }),
    ).toThrow('focalLengthMillimeters');
  });
});
