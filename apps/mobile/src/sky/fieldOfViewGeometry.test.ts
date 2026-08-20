import type { EquipmentRecord } from '../storage/equipmentRepository';
import { angularSeparationDegrees } from './planetariumProjection';
import { createRectilinearFieldOfViewFootprint } from './fieldOfViewGeometry';

const equipment: EquipmentRecord = {
  apertureMillimeters: 80,
  createdAtUtc: '2026-08-20T00:00:00.000Z',
  focalLengthMillimeters: 400,
  frameRotationDegrees: 0,
  id: 'wide-sensor',
  name: 'Wide sensor',
  pixelSizeMicrometers: 3.76,
  sensorHeightMillimeters: 12,
  sensorWidthMillimeters: 24,
  updatedAtUtc: '2026-08-20T00:00:00.000Z',
};

describe('rectilinear spherical field of view', () => {
  it('creates four ordered sensor corners with the requested centre spans', () => {
    const footprint = createRectilinearFieldOfViewFootprint({
      center: { altitudeDegrees: 48, azimuthDegrees: 359 },
      equipment,
      maximumStepDegrees: 0.25,
    });

    expect(footprint.corners).toHaveLength(4);
    expect(footprint.boundary.length).toBeGreaterThan(footprint.corners.length);
    expect(
      angularSeparationDegrees(
        footprint.edgeMidpoints.left,
        footprint.edgeMidpoints.right,
      ),
    ).toBeCloseTo(footprint.horizontalFovDegrees, 5);
    expect(
      angularSeparationDegrees(
        footprint.edgeMidpoints.top,
        footprint.edgeMidpoints.bottom,
      ),
    ).toBeCloseTo(footprint.verticalFovDegrees, 5);
  });

  it('stays finite and rectangular at the zenith instead of adding invalid altitude offsets', () => {
    const footprint = createRectilinearFieldOfViewFootprint({
      center: { altitudeDegrees: 90, azimuthDegrees: 0 },
      equipment: { ...equipment, frameRotationDegrees: 27 },
      maximumStepDegrees: 0.25,
    });

    expect(footprint.boundary.length).toBeGreaterThan(20);
    expect(
      footprint.boundary.every(
        ({ altitudeDegrees, azimuthDegrees }) =>
          Number.isFinite(altitudeDegrees) &&
          Number.isFinite(azimuthDegrees) &&
          altitudeDegrees <= 90 &&
          altitudeDegrees >= -90 &&
          azimuthDegrees >= 0 &&
          azimuthDegrees < 360,
      ),
    ).toBe(true);
    expect(
      Math.max(
        ...footprint.boundary.map(({ altitudeDegrees }) => altitudeDegrees),
      ),
    ).toBeLessThan(90);
    expect(
      new Set(
        footprint.corners.map(({ azimuthDegrees }) =>
          azimuthDegrees.toFixed(2),
        ),
      ).size,
    ).toBe(4);
  });
});
