import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import { evaluateEquipmentSuitability } from './equipmentSuitability';

const equipment: EquipmentRecord = {
  id: 'equipment-1',
  name: 'Wide field',
  focalLengthMillimeters: 400,
  apertureMillimeters: 80,
  sensorWidthMillimeters: 36,
  sensorHeightMillimeters: 24,
  pixelSizeMicrometers: 4,
  frameRotationDegrees: 0,
  createdAtUtc: '2026-01-01T00:00:00.000Z',
  updatedAtUtc: '2026-01-01T00:00:00.000Z',
};

const dwarfThreeTelephoto: EquipmentRecord = {
  ...equipment,
  id: 'dwarf-3',
  name: 'Dwarf 3',
  focalLengthMillimeters: 150,
  sensorWidthMillimeters: 7.68,
  sensorHeightMillimeters: 4.32,
  pixelSizeMicrometers: 2,
};

const target = (
  dimensions: Pick<
    CatalogueTarget,
    'majorAxisArcminutes' | 'minorAxisArcminutes'
  >,
): CatalogueTarget => ({
  id: 'target-1',
  preferredName: 'Fixture nebula',
  aliases: [],
  rightAscensionJ2000Hours: 1,
  declinationJ2000Degrees: 2,
  constellation: 'And',
  objectType: 'Nebula',
  ...dimensions,
  memberships: { messier: [], ngc: ['NGC 1'], ic: [] },
  prominenceTier: 2,
});

const imageScaleArcsecondsPerPixel =
  (206_264.806 * equipment.pixelSizeMicrometers) /
  (equipment.focalLengthMillimeters * 1000);
const minorAxisArcminutesForPixels = (pixels: number) =>
  (pixels * imageScaleArcsecondsPerPixel) / 60;

describe('equipment suitability', () => {
  it('accepts a known target that fits inside 90 percent of the frame and spans at least 60 pixels', () => {
    const result = evaluateEquipmentSuitability(
      target({ majorAxisArcminutes: 120, minorAxisArcminutes: 60 }),
      equipment,
    );

    expect(result).toMatchObject({
      eligible: true,
      reason: 'suitable',
      frameFillLimitPercent: 90,
    });
    expect(result.minorAxisPixels).toBeGreaterThan(60);
  });

  it('rejects a target whose axes cannot fit the usable frame in either orientation', () => {
    const result = evaluateEquipmentSuitability(
      target({ majorAxisArcminutes: 400, minorAxisArcminutes: 300 }),
      equipment,
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('tooLarge');
    expect(result.explanation).toContain('90%');
  });

  it.each([9, 59.9])(
    'rejects a target only %s sensor pixels across its minor axis',
    (minorAxisPixels) => {
      const result = evaluateEquipmentSuitability(
        target({
          majorAxisArcminutes: minorAxisArcminutesForPixels(minorAxisPixels),
          minorAxisArcminutes: minorAxisArcminutesForPixels(minorAxisPixels),
        }),
        equipment,
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('tooSmall');
      expect(result.minorAxisPixels).toBeCloseTo(minorAxisPixels, 8);
      expect(result.explanation).toContain('60 pixels');
    },
  );

  it('accepts the exact 60 sensor-pixel readability boundary', () => {
    const result = evaluateEquipmentSuitability(
      target({
        majorAxisArcminutes: minorAxisArcminutesForPixels(60),
        minorAxisArcminutes: minorAxisArcminutesForPixels(60),
      }),
      equipment,
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('suitable');
    expect(result.minorAxisPixels).toBeCloseTo(60, 8);
  });

  it('rejects the Blinking Planetary for the Dwarf 3 despite fitting the frame', () => {
    const result = evaluateEquipmentSuitability(
      {
        ...target({ majorAxisArcminutes: 0.42 }),
        id: 'NGC6826',
        preferredName: 'Blinking Planetary',
      },
      dwarfThreeTelephoto,
    );

    expect(result.reason).toBe('tooSmall');
    expect(result.minorAxisPixels).toBeCloseTo(9.16, 1);
    expect(result.explanation).toContain('about 9 pixels');
  });

  it('includes unknown-size targets but states that optical fit is unassessed', () => {
    const result = evaluateEquipmentSuitability(target({}), equipment);

    expect(result).toMatchObject({
      eligible: true,
      reason: 'sizeUnknown',
      minorAxisPixels: null,
    });
    expect(result.explanation).toContain('size is unavailable');
  });
});
