import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import {
  evaluateEquipmentSuitability,
  MINIMUM_MINOR_AXIS_PIXELS,
} from './equipmentSuitability';
import type { RankedTarget } from './rankedTargetCalculation';

export type TargetOrder = 'biggest' | 'longestVisible';
export type TargetFilterInputs = Readonly<{
  minSizePixels: string;
  maxSizePixels: string;
  minDurationMinutes: string;
}>;
export type TargetFilterLimits = Readonly<
  Record<keyof TargetFilterInputs, number | null>
>;
export const DEFAULT_TARGET_FILTER_INPUTS: TargetFilterInputs = Object.freeze({
  minSizePixels: '',
  maxSizePixels: '',
  minDurationMinutes: '',
});
export const DEFAULT_TARGET_FILTER_LIMITS: TargetFilterLimits = Object.freeze({
  minSizePixels: null,
  maxSizePixels: null,
  minDurationMinutes: null,
});

export function resolveTargetFilterInputs(
  inputs: TargetFilterInputs,
  previous: TargetFilterLimits,
) {
  const errors: Partial<Record<keyof TargetFilterInputs, string>> = {};
  const parsed = { ...DEFAULT_TARGET_FILTER_LIMITS };
  for (const key of Object.keys(inputs) as (keyof TargetFilterInputs)[]) {
    const text = inputs[key].trim();
    if (text === '') continue;
    const value = Number(text);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(value)) {
      errors[key] = 'Enter a nonnegative number.';
    } else if (
      key !== 'minDurationMinutes' &&
      value < MINIMUM_MINOR_AXIS_PIXELS
    ) {
      errors[key] = `Size must be at least ${MINIMUM_MINOR_AXIS_PIXELS} px.`;
    } else {
      parsed[key] = value;
    }
  }
  if (
    !errors.minSizePixels &&
    !errors.maxSizePixels &&
    parsed.minSizePixels !== null &&
    parsed.maxSizePixels !== null &&
    parsed.maxSizePixels < parsed.minSizePixels
  ) {
    errors.maxSizePixels = 'Max size must be at least Min size.';
  }
  return {
    errors,
    limits: {
      minSizePixels:
        errors.minSizePixels || errors.maxSizePixels
          ? previous.minSizePixels
          : parsed.minSizePixels,
      maxSizePixels:
        errors.minSizePixels || errors.maxSizePixels
          ? previous.maxSizePixels
          : parsed.maxSizePixels,
      minDurationMinutes: errors.minDurationMinutes
        ? previous.minDurationMinutes
        : parsed.minDurationMinutes,
    } satisfies TargetFilterLimits,
  };
}

export function targetMatchesSizeLimits(
  target: CatalogueTarget,
  equipment: EquipmentRecord | null,
  limits: TargetFilterLimits,
): boolean {
  if (!equipment) return true;
  const suitability = evaluateEquipmentSuitability(target, equipment);
  const pixels = suitability.minorAxisPixels;
  return (
    suitability.eligible &&
    pixels !== null &&
    (limits.minSizePixels === null || pixels >= limits.minSizePixels) &&
    (limits.maxSizePixels === null || pixels <= limits.maxSizePixels)
  );
}

export function rankedTargetMatchesLimits(
  result: RankedTarget,
  equipment: EquipmentRecord | null,
  limits: TargetFilterLimits,
): boolean {
  return (
    targetMatchesSizeLimits(result.target, equipment, limits) &&
    (limits.minDurationMinutes === null ||
      result.totalDurationMilliseconds >= limits.minDurationMinutes * 60_000)
  );
}
