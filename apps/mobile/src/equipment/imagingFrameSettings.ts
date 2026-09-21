import type {
  ImagingFrameSettings,
  TrackingMode,
} from '../astronomy/imagingFrame';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import { calculateAngularFieldOfView } from './fieldOfView';

export const TRACKING_MODE_LABELS: Record<TrackingMode, string> = {
  altaz: 'AltAz',
  equatorial: 'EQ',
  derotatedAltaz: 'AltAz + field rotator',
};

export function imagingFrameForEquipment(
  equipment: EquipmentRecord | null,
): ImagingFrameSettings | null {
  if (!equipment) return null;
  return {
    apertureMillimeters: equipment.apertureMillimeters,
    lensOffsetMillimeters: equipment.lensOffsetMillimeters ?? 0,
    ...calculateAngularFieldOfView(equipment),
    orientationDegrees: equipment.frameOrientationDegrees ?? 0,
    trackingMode: equipment.trackingMode ?? 'altaz',
  };
}
