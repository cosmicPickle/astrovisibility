import type { EquipmentRecord } from '../storage/equipmentRepository';
import { createScreenCenteredFieldOfViewFrame } from './fieldOfViewGeometry';

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

describe('screen-centred field of view frame', () => {
  it('renders the DWARF 3 telephoto field as a small 16:9 all-sky reticle', () => {
    const frame = createScreenCenteredFieldOfViewFrame({
      cameraFieldOfViewDegrees: 180,
      canvas: { widthPixels: 1080, heightPixels: 1600 },
      equipment: {
        ...equipment,
        apertureMillimeters: 35,
        focalLengthMillimeters: 150,
        name: 'DWARF 3',
        pixelSizeMicrometers: 2,
        sensorHeightMillimeters: 4.32,
        sensorWidthMillimeters: 7.68,
      },
    });

    expect(frame.horizontalFovDegrees).toBeCloseTo(2.933, 3);
    expect(frame.verticalFovDegrees).toBeCloseTo(1.65, 3);
    expect(frame.widthPixels / frame.heightPixels).toBeCloseTo(16 / 9, 2);
    expect(frame.widthPixels).toBeLessThan(20);
    expect(frame.heightPixels).toBeLessThan(12);
  });

  it('is a literal rectangle centred on the viewport and independent of a sky target', () => {
    const frame = createScreenCenteredFieldOfViewFrame({
      cameraFieldOfViewDegrees: 90,
      canvas: { widthPixels: 1080, heightPixels: 1600 },
      equipment,
    });

    expect(frame.center).toEqual({ xPixels: 540, yPixels: 800 });
    expect(frame.corners).toEqual([
      {
        xPixels: 540 - frame.widthPixels / 2,
        yPixels: 800 - frame.heightPixels / 2,
      },
      {
        xPixels: 540 + frame.widthPixels / 2,
        yPixels: 800 - frame.heightPixels / 2,
      },
      {
        xPixels: 540 + frame.widthPixels / 2,
        yPixels: 800 + frame.heightPixels / 2,
      },
      {
        xPixels: 540 - frame.widthPixels / 2,
        yPixels: 800 + frame.heightPixels / 2,
      },
    ]);
  });

  it('grows by the stereographic angular scale when the atlas zooms in', () => {
    const wide = createScreenCenteredFieldOfViewFrame({
      cameraFieldOfViewDegrees: 180,
      canvas: { widthPixels: 1080, heightPixels: 1600 },
      equipment,
    });
    const zoomed = createScreenCenteredFieldOfViewFrame({
      cameraFieldOfViewDegrees: 45,
      canvas: { widthPixels: 1080, heightPixels: 1600 },
      equipment,
    });

    expect(zoomed.widthPixels).toBeGreaterThan(wide.widthPixels * 4);
    expect(zoomed.heightPixels).toBeGreaterThan(wide.heightPixels * 4);
    expect(zoomed.horizontalFovDegrees).toBe(wide.horizontalFovDegrees);
    expect(zoomed.verticalFovDegrees).toBe(wide.verticalFovDegrees);
  });

  it('rotates the same rectangular screen reticle around the viewport centre', () => {
    const frame = createScreenCenteredFieldOfViewFrame({
      cameraFieldOfViewDegrees: 60,
      canvas: { widthPixels: 390, heightPixels: 700 },
      equipment: { ...equipment, frameRotationDegrees: 90 },
    });

    const [topLeft, topRight] = frame.corners;
    expect(topLeft.xPixels).toBeCloseTo(topRight.xPixels, 8);
    expect(Math.abs(topLeft.yPixels - topRight.yPixels)).toBeCloseTo(
      frame.widthPixels,
      8,
    );
    expect(
      frame.corners.every(
        ({ xPixels, yPixels }) =>
          Number.isFinite(xPixels) && Number.isFinite(yPixels),
      ),
    ).toBe(true);
  });
});
