import type { EquipmentRecord } from '../storage/equipmentRepository';
import { calculateAngularFieldOfView } from './fieldOfView';

export interface EquipmentFormValues {
  name: string;
  focalLengthMillimeters: string;
  apertureMillimeters: string;
  sensorWidthPixels: string;
  sensorHeightPixels: string;
  pixelSizeMicrometers: string;
}

export type EquipmentFormData = Omit<
  EquipmentRecord,
  'id' | 'createdAtUtc' | 'updatedAtUtc'
>;

export interface EquipmentPreview {
  horizontalFovDegrees: number;
  verticalFovDegrees: number;
}

export type EquipmentFormResult =
  | { success: true; data: EquipmentFormData }
  | {
      success: false;
      field: keyof EquipmentFormValues;
      message: string;
    };

export const MAXIMUM_RESOLUTION_PIXELS = 100_000;

export function createEquipmentFormDefaults(): EquipmentFormValues {
  return {
    name: '',
    focalLengthMillimeters: '',
    apertureMillimeters: '',
    sensorWidthPixels: '',
    sensorHeightPixels: '',
    pixelSizeMicrometers: '',
  };
}

export function equipmentToFormValues(
  equipment: EquipmentRecord,
): EquipmentFormValues {
  return {
    name: equipment.name,
    focalLengthMillimeters: String(equipment.focalLengthMillimeters),
    apertureMillimeters: String(equipment.apertureMillimeters),
    sensorWidthPixels: String(equipment.sensorWidthPixels),
    sensorHeightPixels: String(equipment.sensorHeightPixels),
    pixelSizeMicrometers: String(equipment.pixelSizeMicrometers),
  };
}

const positiveNumericFields: ReadonlyArray<{
  field: Exclude<
    keyof EquipmentFormValues,
    'name' | 'sensorWidthPixels' | 'sensorHeightPixels'
  >;
  label: string;
}> = [
  { field: 'focalLengthMillimeters', label: 'focal length' },
  { field: 'apertureMillimeters', label: 'aperture' },
  { field: 'pixelSizeMicrometers', label: 'pixel size' },
];

const parseResolution = (
  values: EquipmentFormValues,
  field: 'sensorWidthPixels' | 'sensorHeightPixels',
  label: string,
): EquipmentFormResult | number => {
  const rawValue = values[field].trim();
  const numberValue = Number(rawValue);
  if (rawValue === '' || !Number.isFinite(numberValue)) {
    return {
      success: false,
      field,
      message: `Enter a valid resolution ${label}.`,
    };
  }
  if (
    !Number.isInteger(numberValue) ||
    numberValue <= 0 ||
    numberValue > MAXIMUM_RESOLUTION_PIXELS
  ) {
    return {
      success: false,
      field,
      message: `Resolution ${label} must be a positive whole number.`,
    };
  }
  return numberValue;
};

export function parseEquipmentForm(
  values: EquipmentFormValues,
): EquipmentFormResult {
  const name = values.name.trim();
  if (name.length === 0 || name.length > 120) {
    return {
      success: false,
      field: 'name',
      message: 'Enter a name between 1 and 120 characters.',
    };
  }

  const parsedPositiveValues = {} as Record<
    (typeof positiveNumericFields)[number]['field'],
    number
  >;
  for (const definition of positiveNumericFields) {
    const rawValue = values[definition.field].trim();
    const numberValue = Number(rawValue);
    if (rawValue === '' || !Number.isFinite(numberValue)) {
      return {
        success: false,
        field: definition.field,
        message: `Enter a valid ${definition.label}.`,
      };
    }
    if (numberValue <= 0) {
      const capitalized =
        definition.label[0]?.toUpperCase() + definition.label.slice(1);
      return {
        success: false,
        field: definition.field,
        message: `${capitalized} must be greater than 0.`,
      };
    }
    parsedPositiveValues[definition.field] = numberValue;
  }

  const sensorWidthPixels = parseResolution(
    values,
    'sensorWidthPixels',
    'width',
  );
  if (typeof sensorWidthPixels !== 'number') return sensorWidthPixels;
  const sensorHeightPixels = parseResolution(
    values,
    'sensorHeightPixels',
    'height',
  );
  if (typeof sensorHeightPixels !== 'number') return sensorHeightPixels;

  return {
    success: true,
    data: {
      name,
      ...parsedPositiveValues,
      sensorWidthPixels,
      sensorHeightPixels,
    },
  };
}

export function calculateEquipmentPreview(
  input: EquipmentFormData,
): EquipmentPreview {
  return calculateAngularFieldOfView(input);
}
