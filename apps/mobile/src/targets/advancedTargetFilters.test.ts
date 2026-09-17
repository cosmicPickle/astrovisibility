import {
  resolveTargetFilterInputs,
  targetMatchesSizeLimits,
  rankedTargetMatchesLimits,
  DEFAULT_TARGET_FILTER_INPUTS,
  DEFAULT_TARGET_FILTER_LIMITS,
} from './advancedTargetFilters';
import { evaluateEquipmentSuitability } from './equipmentSuitability';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type { RankedTarget } from './rankedTargetCalculation';

const equipment: EquipmentRecord = {
  id: 'optics',
  name: 'Fixture',
  focalLengthMillimeters: 400,
  apertureMillimeters: 80,
  sensorWidthPixels: 4000,
  sensorHeightPixels: 3000,
  pixelSizeMicrometers: 4,
  createdAtUtc: '',
  updatedAtUtc: '',
};
const target: CatalogueTarget = {
  id: 'fixture',
  preferredName: 'Fixture',
  aliases: [],
  constellation: 'And',
  objectType: 'G',
  rightAscensionJ2000Hours: 1,
  declinationJ2000Degrees: 30,
  majorAxisArcminutes: 100,
  minorAxisArcminutes: 10,
  memberships: { messier: [], ngc: [], ic: [] },
  prominenceTier: 2,
};

it('validates drafts and preserves applied size limits while correcting invalid ranges', () => {
  const previous = {
    minSizePixels: 100,
    maxSizePixels: 200,
    minDurationMinutes: 30,
  };
  for (const value of ['59', '-1', 'Infinity', 'NaN', '1e3', 'abc']) {
    const result = resolveTargetFilterInputs(
      {
        ...DEFAULT_TARGET_FILTER_INPUTS,
        minSizePixels: value,
        minDurationMinutes: '45',
      },
      previous,
    );
    expect(result.errors.minSizePixels).toBeTruthy();
    expect(result.limits).toEqual({ ...previous, minDurationMinutes: 45 });
  }
  const inverted = resolveTargetFilterInputs(
    { minSizePixels: '300', maxSizePixels: '200', minDurationMinutes: '' },
    previous,
  );
  expect(inverted.errors.maxSizePixels).toBeTruthy();
  expect(inverted.limits.minSizePixels).toBe(100);
  expect(
    resolveTargetFilterInputs(DEFAULT_TARGET_FILTER_INPUTS, previous).limits,
  ).toEqual(DEFAULT_TARGET_FILTER_LIMITS);
  expect(
    resolveTargetFilterInputs(
      { minSizePixels: '60', maxSizePixels: '150.5', minDurationMinutes: '0' },
      previous,
    ).limits,
  ).toEqual({ minSizePixels: 60, maxSizePixels: 150.5, minDurationMinutes: 0 });
});

it('uses inclusive minor-axis pixel limits and retains global suitability', () => {
  const pixels = evaluateEquipmentSuitability(
    target,
    equipment,
  ).minorAxisPixels!;
  const limits = {
    ...DEFAULT_TARGET_FILTER_LIMITS,
    minSizePixels: pixels,
    maxSizePixels: pixels,
  };
  expect(targetMatchesSizeLimits(target, equipment, limits)).toBe(true);
  expect(
    targetMatchesSizeLimits(target, equipment, {
      ...limits,
      maxSizePixels: pixels - 0.1,
    }),
  ).toBe(false);
  expect(
    targetMatchesSizeLimits(target, equipment, {
      ...limits,
      minSizePixels: pixels + 0.1,
    }),
  ).toBe(false);
  expect(
    targetMatchesSizeLimits(
      { ...target, minorAxisArcminutes: 0.1 },
      equipment,
      { ...DEFAULT_TARGET_FILTER_LIMITS, minSizePixels: 1 },
    ),
  ).toBe(false);
  expect(
    targetMatchesSizeLimits(
      { ...target, majorAxisArcminutes: undefined },
      equipment,
      limits,
    ),
  ).toBe(false);
  expect(targetMatchesSizeLimits(target, null, limits)).toBe(true);
  expect(
    targetMatchesSizeLimits(
      { ...target, majorAxisArcminutes: 10, minorAxisArcminutes: undefined },
      equipment,
      limits,
    ),
  ).toBe(true);
});

it('filters total duration across intervals, including unassessed dark time, without rounding', () => {
  const ranked: RankedTarget = {
    target,
    suitability: null,
    intervals: [],
    longestIntervalMilliseconds: 10 * 60000,
    totalDurationMilliseconds: 30 * 60000,
    durationKind: 'aboveHorizonUnassessed',
  };
  expect(
    rankedTargetMatchesLimits(ranked, null, {
      ...DEFAULT_TARGET_FILTER_LIMITS,
      minDurationMinutes: 30,
    }),
  ).toBe(true);
  expect(
    rankedTargetMatchesLimits(ranked, null, {
      ...DEFAULT_TARGET_FILTER_LIMITS,
      minDurationMinutes: 30.01,
    }),
  ).toBe(false);
});
