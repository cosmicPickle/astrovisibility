import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import { calculateAngularFieldOfView } from '../equipment/fieldOfView';
import type { EquipmentRecord } from '../storage/equipmentRepository';

export type EquipmentSuitabilityReason =
  'suitable' | 'sizeUnknown' | 'tooSmall';

export type EquipmentSuitability = Readonly<{
  eligible: boolean;
  explanation: string;
  horizontalFovDegrees: number;
  minorAxisPixels: number | null;
  reason: EquipmentSuitabilityReason;
  verticalFovDegrees: number;
}>;

const MINIMUM_MINOR_AXIS_PIXELS = 60;
const ARCSECONDS_PER_RADIAN = 206_264.806;

/**
 * Applies the v1 optical readability rule. Large targets remain eligible for
 * mosaics; obstruction visibility remains a centre-point calculation and is
 * deliberately not part of this decision.
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
    ...fieldOfView,
    minorAxisPixels: null,
    reason: 'sizeUnknown' as const,
  };
  if (target.majorAxisArcminutes === undefined) return unknownResult;

  const minorAxisDegrees =
    (target.minorAxisArcminutes ?? target.majorAxisArcminutes) / 60;
  const imageScaleArcsecondsPerPixel =
    (ARCSECONDS_PER_RADIAN * equipment.pixelSizeMicrometers) /
    (equipment.focalLengthMillimeters * 1000);
  const minorAxisPixels =
    (minorAxisDegrees * 3600) / imageScaleArcsecondsPerPixel;
  if (minorAxisPixels < MINIMUM_MINOR_AXIS_PIXELS) {
    return {
      eligible: false,
      explanation: `Too small: about ${Math.round(minorAxisPixels)} pixels across the minor axis; at least 60 pixels are required.`,
      ...fieldOfView,
      minorAxisPixels,
      reason: 'tooSmall',
    };
  }
  return {
    eligible: true,
    explanation: `About ${Math.round(minorAxisPixels)} px across the minor axis.`,
    ...fieldOfView,
    minorAxisPixels,
    reason: 'suitable',
  };
}
