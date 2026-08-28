export const MINIMUM_ATLAS_TARGET_COUNT = 10;
export const MAXIMUM_ATLAS_TARGET_COUNT = 200;
export const DEFAULT_MINIMUM_ATLAS_TARGET_COUNT = 100;
export const ATLAS_TARGET_COUNT_STEP = 10;

export const clampAtlasTargetCount = (value: number) => {
  const bounded = Math.max(
    MINIMUM_ATLAS_TARGET_COUNT,
    Math.min(MAXIMUM_ATLAS_TARGET_COUNT, value),
  );
  return (
    Math.round(bounded / ATLAS_TARGET_COUNT_STEP) * ATLAS_TARGET_COUNT_STEP
  );
};
