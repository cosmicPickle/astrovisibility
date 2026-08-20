import { calculateEquipmentPreview, parseEquipmentForm } from './equipmentForm';

const validInput = {
  name: '  Wide-field refractor ',
  focalLengthMillimeters: '400',
  apertureMillimeters: '80',
  sensorWidthMillimeters: '23.5',
  sensorHeightMillimeters: '15.6',
  pixelSizeMicrometers: '3.76',
  frameRotationDegrees: '0',
};

describe('equipment form validation and preview', () => {
  it('normalizes valid optical values and derives field of view and pixels', () => {
    const parsed = parseEquipmentForm(validInput);
    expect(parsed).toEqual({
      success: true,
      data: {
        name: 'Wide-field refractor',
        focalLengthMillimeters: 400,
        apertureMillimeters: 80,
        sensorWidthMillimeters: 23.5,
        sensorHeightMillimeters: 15.6,
        pixelSizeMicrometers: 3.76,
        frameRotationDegrees: 0,
      },
    });
    if (!parsed.success) throw new Error('Expected valid equipment');

    const preview = calculateEquipmentPreview(parsed.data);
    expect(preview.horizontalFovDegrees).toBeCloseTo(3.365, 3);
    expect(preview.verticalFovDegrees).toBeCloseTo(2.234, 3);
    expect(preview.pixelWidth).toBeCloseTo(6250, 0);
    expect(preview.pixelHeight).toBeCloseTo(4148.94, 1);
  });

  it.each([
    ['focalLengthMillimeters', '0', 'Focal length must be greater than 0.'],
    ['apertureMillimeters', '-1', 'Aperture must be greater than 0.'],
    ['sensorWidthMillimeters', 'wide', 'Enter a valid sensor width.'],
    ['pixelSizeMicrometers', '', 'Enter a valid pixel size.'],
  ] as const)('rejects an invalid %s', (field, value, message) => {
    expect(parseEquipmentForm({ ...validInput, [field]: value })).toEqual({
      success: false,
      field,
      message,
    });
  });

  it('rejects pixel resolution entered as physical sensor millimetres', () => {
    expect(
      parseEquipmentForm({
        ...validInput,
        sensorWidthMillimeters: '3840',
        sensorHeightMillimeters: '2160',
        pixelSizeMicrometers: '2',
      }),
    ).toEqual({
      success: false,
      field: 'sensorWidthMillimeters',
      message:
        'Sensor width must be a physical dimension in millimetres, not pixel resolution.',
    });
  });
});
