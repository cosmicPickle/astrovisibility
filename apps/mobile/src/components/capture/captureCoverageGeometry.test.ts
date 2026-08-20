import {
  createCaptureCoverageFootprints,
  getCaptureCardinals,
} from './captureCoverageGeometry';

const map = { heightPixels: 90, widthPixels: 360 };

describe('unfolded capture coverage geometry', () => {
  it('maps a camera-sized footprint into the 360 by 90 degree sky guide', () => {
    expect(
      createCaptureCoverageFootprints(
        {
          centerAltitudeDegrees: 45,
          centerAzimuthDegrees: 180,
          horizontalFieldOfViewDegrees: 62,
          rollDegrees: 0,
          verticalFieldOfViewDegrees: 46.5,
        },
        map,
      ),
    ).toEqual([
      expect.objectContaining({
        centerX: 180,
        centerY: 45,
        height: 46.5,
        rotationDegrees: 0,
        width: 62,
        x: 149,
      }),
    ]);
  });

  it('splits a north-crossing footprint across both map edges', () => {
    const footprints = createCaptureCoverageFootprints(
      {
        centerAltitudeDegrees: 30,
        centerAzimuthDegrees: 358,
        horizontalFieldOfViewDegrees: 40,
        rollDegrees: 8,
        verticalFieldOfViewDegrees: 30,
      },
      map,
    );

    expect(footprints).toHaveLength(2);
    expect(footprints.map(({ centerX }) => centerX)).toEqual([358, -2]);
    expect(
      footprints.every(({ rotationDegrees }) => rotationDegrees === -8),
    ).toBe(true);
    expect(footprints.some(({ x, width }) => x < 360 && x + width > 350)).toBe(
      true,
    );
    expect(footprints.some(({ x, width }) => x < 10 && x + width > 0)).toBe(
      true,
    );
  });

  it('keeps full footprint dimensions beyond the horizon and zenith', () => {
    const horizon = createCaptureCoverageFootprints(
      {
        centerAltitudeDegrees: 4,
        centerAzimuthDegrees: 90,
        horizontalFieldOfViewDegrees: 20,
        rollDegrees: 0,
        verticalFieldOfViewDegrees: 30,
      },
      map,
    )[0];
    const zenith = createCaptureCoverageFootprints(
      {
        centerAltitudeDegrees: 86,
        centerAzimuthDegrees: 270,
        horizontalFieldOfViewDegrees: 20,
        rollDegrees: 0,
        verticalFieldOfViewDegrees: 30,
      },
      map,
    )[0];

    expect(horizon).toEqual(
      expect.objectContaining({ centerY: 86, height: 30, y: 71 }),
    );
    expect(zenith).toEqual(
      expect.objectContaining({ centerY: 4, height: 30, y: -11 }),
    );
    expect(horizon?.centerX).toBe(90);
    expect(zenith?.centerX).toBe(270);
  });

  it('places red-cardinal anchors at the horizon in north-east-south-west order', () => {
    expect(getCaptureCardinals(map)).toEqual([
      { label: 'N', x: 4, y: 84 },
      { label: 'E', x: 90, y: 84 },
      { label: 'S', x: 180, y: 84 },
      { label: 'W', x: 270, y: 84 },
    ]);
  });
});
