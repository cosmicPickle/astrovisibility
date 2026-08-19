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

describe('equipment suitability', () => {
  it('accepts a known target that fits inside 90 percent of the frame and spans at least eight pixels', () => {
    const result = evaluateEquipmentSuitability(
      target({ majorAxisArcminutes: 120, minorAxisArcminutes: 60 }),
      equipment,
    );

    expect(result).toMatchObject({
      eligible: true,
      reason: 'suitable',
      frameFillLimitPercent: 90,
    });
    expect(result.minorAxisPixels).toBeGreaterThan(8);
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

  it('rejects a target smaller than eight sensor pixels across its minor axis', () => {
    const result = evaluateEquipmentSuitability(
      target({ majorAxisArcminutes: 0.2, minorAxisArcminutes: 0.1 }),
      equipment,
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('tooSmall');
    expect(result.explanation).toContain('8 pixels');
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
