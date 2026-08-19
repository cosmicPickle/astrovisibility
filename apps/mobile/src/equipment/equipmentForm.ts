import type { EquipmentRecord } from '../storage/equipmentRepository';
import { calculateAngularFieldOfView } from './fieldOfView';

export interface EquipmentFormValues {
  name: string;
  focalLengthMillimeters: string;
  apertureMillimeters: string;
  sensorWidthMillimeters: string;
  sensorHeightMillimeters: string;
  pixelSizeMicrometers: string;
  frameRotationDegrees: string;
}

export type EquipmentFormData = Omit<
  EquipmentRecord,
  'id' | 'createdAtUtc' | 'updatedAtUtc'
>;

export interface EquipmentPreview {
  horizontalFovDegrees: number;
  verticalFovDegrees: number;
  pixelWidth: number;
  pixelHeight: number;
}

export type EquipmentFormResult =
  | { success: true; data: EquipmentFormData }
  | {
      success: false;
      field: keyof EquipmentFormValues;
      message: string;
    };

export function createEquipmentFormDefaults(): EquipmentFormValues {
  return {
    name: '',
    focalLengthMillimeters: '',
    apertureMillimeters: '',
    sensorWidthMillimeters: '',
    sensorHeightMillimeters: '',
    pixelSizeMicrometers: '',
    frameRotationDegrees: '0',
  };
}

export function equipmentToFormValues(
  equipment: EquipmentRecord,
): EquipmentFormValues {
  return {
    name: equipment.name,
    focalLengthMillimeters: String(equipment.focalLengthMillimeters),
    apertureMillimeters: String(equipment.apertureMillimeters),
    sensorWidthMillimeters: String(equipment.sensorWidthMillimeters),
    sensorHeightMillimeters: String(equipment.sensorHeightMillimeters),
    pixelSizeMicrometers: String(equipment.pixelSizeMicrometers),
    frameRotationDegrees: String(equipment.frameRotationDegrees),
  };
}

const numericFields: ReadonlyArray<{
  field: Exclude<keyof EquipmentFormValues, 'name'>;
  label: string;
  positive: boolean;
}> = [
  {
    field: 'focalLengthMillimeters',
    label: 'focal length',
    positive: true,
  },
  { field: 'apertureMillimeters', label: 'aperture', positive: true },
  { field: 'sensorWidthMillimeters', label: 'sensor width', positive: true },
  {
    field: 'sensorHeightMillimeters',
    label: 'sensor height',
    positive: true,
  },
  { field: 'pixelSizeMicrometers', label: 'pixel size', positive: true },
  {
    field: 'frameRotationDegrees',
    label: 'frame rotation',
    positive: false,
  },
];

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

  const parsed = {} as Record<
    Exclude<keyof EquipmentFormValues, 'name'>,
    number
  >;
  for (const definition of numericFields) {
    const rawValue = values[definition.field].trim();
    const numberValue = Number(rawValue);
    if (rawValue === '' || !Number.isFinite(numberValue)) {
      return {
        success: false,
        field: definition.field,
        message: `Enter a valid ${definition.label}.`,
      };
    }
    if (definition.positive && numberValue <= 0) {
      const capitalized =
        definition.label[0]?.toUpperCase() + definition.label.slice(1);
      return {
        success: false,
        field: definition.field,
        message: `${capitalized} must be greater than 0.`,
      };
    }
    parsed[definition.field] = numberValue;
  }

  return {
    success: true,
    data: { name, ...parsed },
  };
}

export function calculateEquipmentPreview(
  input: Pick<
    EquipmentFormData,
    | 'focalLengthMillimeters'
    | 'sensorWidthMillimeters'
    | 'sensorHeightMillimeters'
    | 'pixelSizeMicrometers'
  >,
): EquipmentPreview {
  const fieldOfView = calculateAngularFieldOfView(input);
  return {
    ...fieldOfView,
    pixelWidth:
      (input.sensorWidthMillimeters * 1000) / input.pixelSizeMicrometers,
    pixelHeight:
      (input.sensorHeightMillimeters * 1000) / input.pixelSizeMicrometers,
  };
}
