import {
  calculateAngularFieldOfView,
  createRotatedFieldOfViewRectangle,
} from './fieldOfView';

const equipment = {
  focalLengthMillimeters: 400,
  sensorWidthPixels: 6250,
  sensorHeightPixels: 4149,
  pixelSizeMicrometers: 3.76,
};

describe('field-of-view geometry', () => {
  it('calculates angular field from resolution and pixel size', () => {
    expect(calculateAngularFieldOfView(equipment)).toEqual({
      horizontalFovDegrees: expect.closeTo(3.365, 3),
      verticalFovDegrees: expect.closeTo(2.234, 3),
    });
  });

  it('rotates a centered angular rectangle with dynamic atlas orientation', () => {
    const rectangle = createRotatedFieldOfViewRectangle(equipment, 90);

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
  });

  it('rejects non-physical optical dimensions', () => {
    expect(() =>
      calculateAngularFieldOfView({
        ...equipment,
        focalLengthMillimeters: 0,
      }),
    ).toThrow('focalLengthMillimeters');
  });
});
