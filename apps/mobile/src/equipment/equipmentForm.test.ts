import { calculateEquipmentPreview, parseEquipmentForm } from './equipmentForm';

const validInput = {
  name: '  Wide-field refractor ',
  focalLengthMillimeters: '400',
  apertureMillimeters: '80',
  sensorWidthPixels: '6250',
  sensorHeightPixels: '4149',
  pixelSizeMicrometers: '3.76',
};

describe('equipment form validation and preview', () => {
  it('normalizes resolution values and derives the physical field of view', () => {
    const parsed = parseEquipmentForm(validInput);
    expect(parsed).toEqual({
      success: true,
      data: {
        name: 'Wide-field refractor',
        focalLengthMillimeters: 400,
        apertureMillimeters: 80,
        sensorWidthPixels: 6250,
        sensorHeightPixels: 4149,
        pixelSizeMicrometers: 3.76,
      },
    });
    if (!parsed.success) throw new Error('Expected valid equipment');

    const preview = calculateEquipmentPreview(parsed.data);
    expect(preview.horizontalFovDegrees).toBeCloseTo(3.365, 3);
    expect(preview.verticalFovDegrees).toBeCloseTo(2.234, 3);
  });

  it.each([
    ['focalLengthMillimeters', '0', 'Focal length must be greater than 0.'],
    ['apertureMillimeters', '-1', 'Aperture must be greater than 0.'],
    ['sensorWidthPixels', 'wide', 'Enter a valid resolution width.'],
    ['pixelSizeMicrometers', '', 'Enter a valid pixel size.'],
  ] as const)('rejects an invalid %s', (field, value, message) => {
    expect(parseEquipmentForm({ ...validInput, [field]: value })).toEqual({
      success: false,
      field,
      message,
    });
  });

  it('requires resolution dimensions to be whole pixels', () => {
    expect(
      parseEquipmentForm({ ...validInput, sensorWidthPixels: '6250.5' }),
    ).toEqual({
      success: false,
      field: 'sensorWidthPixels',
      message: 'Resolution width must be a positive whole number.',
    });
  });
});
