import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import { calculateAngularFieldOfView } from '../equipment/fieldOfView';
import type { EquipmentRecord } from '../storage/equipmentRepository';

export type EquipmentSuitabilityReason =
  'suitable' | 'sizeUnknown' | 'tooLarge' | 'tooSmall';

export type EquipmentSuitability = Readonly<{
  eligible: boolean;
  explanation: string;
  frameFillLimitPercent: 90;
  horizontalFovDegrees: number;
  minorAxisPixels: number | null;
  reason: EquipmentSuitabilityReason;
  verticalFovDegrees: number;
}>;

const FRAME_FILL_FRACTION = 0.9;
const MINIMUM_MINOR_AXIS_PIXELS = 60;
const ARCSECONDS_PER_RADIAN = 206_264.806;

/**
 * Applies the v1 optical recommendation rule. The target may be framed in
 * either portrait or landscape orientation; obstruction visibility remains a
 * centre-point calculation and is deliberately not part of this decision.
 */
export function evaluateEquipmentSuitability(
  target: CatalogueTarget,
  equipment: EquipmentRecord,
): EquipmentSuitability {
  const fieldOfView = calculateAngularFieldOfView(equipment);
  const unknownResult = {
    eligible: true,
    explanation:
      'Angular size is unavailable; included because optical fit cannot be assessed.',
    frameFillLimitPercent: 90 as const,
    ...fieldOfView,
    minorAxisPixels: null,
    reason: 'sizeUnknown' as const,
  };
  if (target.majorAxisArcminutes === undefined) return unknownResult;

  const majorAxisDegrees = target.majorAxisArcminutes / 60;
  const minorAxisDegrees =
    (target.minorAxisArcminutes ?? target.majorAxisArcminutes) / 60;
  const targetLongAxisDegrees = Math.max(majorAxisDegrees, minorAxisDegrees);
  const targetShortAxisDegrees = Math.min(majorAxisDegrees, minorAxisDegrees);
  const frameLongAxisDegrees =
    Math.max(fieldOfView.horizontalFovDegrees, fieldOfView.verticalFovDegrees) *
    FRAME_FILL_FRACTION;
  const frameShortAxisDegrees =
    Math.min(fieldOfView.horizontalFovDegrees, fieldOfView.verticalFovDegrees) *
    FRAME_FILL_FRACTION;
  const imageScaleArcsecondsPerPixel =
    (ARCSECONDS_PER_RADIAN * equipment.pixelSizeMicrometers) /
    (equipment.focalLengthMillimeters * 1000);
  const minorAxisPixels =
    (targetShortAxisDegrees * 3600) / imageScaleArcsecondsPerPixel;

  if (
    targetLongAxisDegrees > frameLongAxisDegrees ||
    targetShortAxisDegrees > frameShortAxisDegrees
  ) {
    return {
      eligible: false,
      explanation: 'Too large to fit within 90% of this imaging frame.',
      frameFillLimitPercent: 90,
      ...fieldOfView,
      minorAxisPixels,
      reason: 'tooLarge',
    };
  }
  if (minorAxisPixels < MINIMUM_MINOR_AXIS_PIXELS) {
    return {
      eligible: false,
      explanation: `Too small: about ${Math.round(minorAxisPixels)} pixels across the minor axis; at least 60 pixels are required.`,
      frameFillLimitPercent: 90,
      ...fieldOfView,
      minorAxisPixels,
      reason: 'tooSmall',
    };
  }
  return {
    eligible: true,
    explanation: `Fits within 90% of the frame · about ${Math.round(minorAxisPixels)} px across the minor axis.`,
    frameFillLimitPercent: 90,
    ...fieldOfView,
    minorAxisPixels,
    reason: 'suitable',
  };
}
