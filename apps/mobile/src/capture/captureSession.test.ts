import {
  applyTileCorrection,
  assertCaptureDimensionsWithinLimits,
  CAPTURE_HORIZONTAL_FIELD_OF_VIEW_DEGREES,
  captureOrientationConfidence,
  CAPTURE_VERTICAL_FIELD_OF_VIEW_DEGREES,
  createGuidedCapturePlacement,
  createCapturedTile,
  guidedCaptureAltitudeBounds,
  guidedCaptureAltitudeStatus,
  MAXIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES,
  MINIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES,
  type OrientationSnapshot,
} from './captureSession';

const orientation: OrientationSnapshot = {
  trueHeadingDegrees: 358,
  headingAccuracyDegrees: 12,
  estimatedAltitudeDegrees: 82,
  rollDegrees: -2,
  rawRotation: { alphaRadians: 0.1, betaRadians: 1.2, gammaRadians: 0 },
};

describe('capture proof tile representation', () => {
  const guidedPlacement = (centerAltitudeDegrees: number, rollDegrees = 0) =>
    createGuidedCapturePlacement({
      ...orientation,
      estimatedAltitudeDegrees: centerAltitudeDegrees,
      rollDegrees,
    });

  it('uses the whole camera frame for inclusive 20 through 80 degree limits', () => {
    const lowerBoundaryCenter =
      MINIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES +
      CAPTURE_VERTICAL_FIELD_OF_VIEW_DEGREES / 2;
    const upperBoundaryCenter =
      MAXIMUM_GUIDED_CAPTURE_ALTITUDE_DEGREES -
      CAPTURE_VERTICAL_FIELD_OF_VIEW_DEGREES / 2;

    expect(
      guidedCaptureAltitudeStatus(guidedPlacement(lowerBoundaryCenter - 0.1)),
    ).toBe('too-low');
    expect(
      guidedCaptureAltitudeStatus(guidedPlacement(lowerBoundaryCenter)),
    ).toBe('allowed');
    expect(
      guidedCaptureAltitudeStatus(guidedPlacement(upperBoundaryCenter)),
    ).toBe('allowed');
    expect(
      guidedCaptureAltitudeStatus(guidedPlacement(upperBoundaryCenter + 0.1)),
    ).toBe('too-high');
  });

  it('uses rotated top and bottom edges and rejects a frame spanning both limits', () => {
    const rollDegrees = 10;
    const rollRadians = (rollDegrees * Math.PI) / 180;
    const expectedHalfExtent =
      Math.abs(Math.cos(rollRadians)) *
        (CAPTURE_VERTICAL_FIELD_OF_VIEW_DEGREES / 2) +
      Math.abs(Math.sin(rollRadians)) *
        (CAPTURE_HORIZONTAL_FIELD_OF_VIEW_DEGREES / 2);

    expect(
      guidedCaptureAltitudeBounds(guidedPlacement(50, rollDegrees)),
    ).toEqual({
      highestAltitudeDegrees: 50 + expectedHalfExtent,
      lowestAltitudeDegrees: 50 - expectedHalfExtent,
    });
    expect(guidedCaptureAltitudeStatus(guidedPlacement(50, 90))).toBe(
      'too-tall',
    );
  });

  it('creates live guidance with the shared capture field of view', () => {
    expect(createGuidedCapturePlacement(orientation)).toEqual({
      centerAltitudeDegrees: 82,
      centerAzimuthDegrees: 358,
      horizontalFieldOfViewDegrees: 62,
      rollDegrees: -2,
      verticalFieldOfViewDegrees: 46.5,
    });
  });

  it('rejects oversized or invalid image dimensions before durable storage', () => {
    expect(() =>
      assertCaptureDimensionsWithinLimits(12_000, 3_000),
    ).not.toThrow();
    expect(() => assertCaptureDimensionsWithinLimits(12_001, 3_000)).toThrow(
      /12,000 pixels/i,
    );
    expect(() => assertCaptureDimensionsWithinLimits(10_000, 4_100)).toThrow(
      /40 megapixels/i,
    );
    expect(() => assertCaptureDimensionsWithinLimits(0, 100)).toThrow(
      /positive integers/i,
    );
  });

  it('records raw orientation and upward/seam-crossing angular coverage', () => {
    const tile = createCapturedTile({
      id: 'tile-1',
      uri: 'file:///temporary/tile-1.jpg',
      widthPixels: 1600,
      heightPixels: 1200,
      capturedAtUtc: '2026-08-19T10:00:00.000Z',
      orientation,
      horizontalFieldOfViewDegrees: 62,
      verticalFieldOfViewDegrees: 48,
    });

    expect(tile.orientationSnapshot).toEqual(orientation);
    expect(tile.coveragePolygon[0].azimuthDegrees).toBe(327);
    expect(tile.coveragePolygon[1].azimuthDegrees).toBe(389);
    expect(
      Math.max(...tile.coveragePolygon.map((point) => point.altitudeDegrees)),
    ).toBe(90);
  });

  it('keeps corrections separate from the captured sensor snapshot', () => {
    const tile = createCapturedTile({
      id: 'tile-2',
      uri: 'file:///temporary/tile-2.jpg',
      widthPixels: 1600,
      heightPixels: 1200,
      capturedAtUtc: '2026-08-19T10:01:00.000Z',
      orientation,
      horizontalFieldOfViewDegrees: 62,
      verticalFieldOfViewDegrees: 48,
    });

    const corrected = applyTileCorrection(tile, {
      azimuthDeltaDegrees: 5,
      altitudeDeltaDegrees: -3,
      rollDeltaDegrees: 2,
    });

    expect(corrected.orientationSnapshot.trueHeadingDegrees).toBe(358);
    expect(corrected.reviewedPlacement.centerAzimuthDegrees).toBe(3);
    expect(corrected.reviewedPlacement.centerAltitudeDegrees).toBe(79);
    expect(corrected.reviewedPlacement.rollDegrees).toBe(0);
  });

  it('normalizes reviewed azimuth corrections without changing the sensor snapshot', () => {
    const tile = createCapturedTile({
      id: 'tile-wrap',
      uri: 'file:///temporary/tile-wrap.jpg',
      widthPixels: 1600,
      heightPixels: 1200,
      capturedAtUtc: '2026-08-19T10:02:00.000Z',
      orientation,
      horizontalFieldOfViewDegrees: 62,
      verticalFieldOfViewDegrees: 48,
    });

    const corrected = applyTileCorrection(tile, {
      azimuthDeltaDegrees: 7,
      altitudeDeltaDegrees: 50,
      rollDeltaDegrees: -3,
    });

    expect(corrected.reviewedPlacement.centerAzimuthDegrees).toBe(5);
    expect(corrected.reviewedPlacement.centerAltitudeDegrees).toBe(90);
    expect(corrected.orientationSnapshot.trueHeadingDegrees).toBe(358);
  });

  it('grades captured and manually placed orientation confidence truthfully', () => {
    expect(captureOrientationConfidence(8, true, 'camera')).toBe('high');
    expect(captureOrientationConfidence(35, true, 'camera')).toBe('low');
    expect(captureOrientationConfidence(null, false, 'camera')).toBe('manual');
    expect(captureOrientationConfidence(5, true, 'import')).toBe('manual');
  });
});
