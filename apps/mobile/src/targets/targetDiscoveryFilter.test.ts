import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import {
  filterDiscoveredTargets,
  type TargetCategory,
} from './targetDiscoveryFilter';
import type { RankedTarget } from './rankedTargetCalculation';

const rankedTarget = (
  id: string,
  objectType: string,
  memberships: CatalogueTarget['memberships'],
): RankedTarget => ({
  durationKind: 'visible',
  intervals: [],
  longestIntervalMilliseconds: 0,
  suitability: null,
  target: {
    id,
    aliases: [],
    constellation: 'And',
    declinationJ2000Degrees: 0,
    memberships,
    objectType,
    preferredName: id,
    prominenceTier: 2,
    rightAscensionJ2000Hours: 0,
  },
  totalDurationMilliseconds: 0,
});

const allCategories: readonly TargetCategory[] = [
  'galaxies',
  'nebulae',
  'starClusters',
];

const targets = [
  rankedTarget('NGC0224', 'G', {
    messier: [31],
    ngc: ['NGC 224'],
    ic: [],
  }),
  rankedTarget('IC0434', 'Neb', { messier: [], ngc: [], ic: ['IC 434'] }),
  rankedTarget('NGC869', 'OCl', {
    messier: [],
    ngc: ['NGC 869'],
    ic: [],
    caldwell: 14,
  }),
  rankedTarget('STAR1', '*', { messier: [], ngc: [], ic: [] }),
];

describe('target discovery filters', () => {
  it('matches catalogue identifiers despite case, spacing, and leading zeroes', () => {
    expect(
      filterDiscoveredTargets(targets, 'ngc 0224', allCategories).map(
        ({ target }) => target.id,
      ),
    ).toEqual(['NGC0224']);
    expect(
      filterDiscoveredTargets(targets, 'm31', allCategories).map(
        ({ target }) => target.id,
      ),
    ).toEqual(['NGC0224']);
    expect(
      filterDiscoveredTargets(targets, '14', allCategories).map(
        ({ target }) => target.id,
      ),
    ).toEqual(['NGC869']);
  });

  it('supports independent category selection and hides unrelated types once filtered', () => {
    expect(
      filterDiscoveredTargets(targets, '', ['galaxies', 'starClusters']).map(
        ({ target }) => target.id,
      ),
    ).toEqual(['NGC0224', 'NGC869']);
  });

  it('preserves uncategorized objects only in the default all-selected view', () => {
    expect(filterDiscoveredTargets(targets, '', allCategories)).toHaveLength(4);
    expect(filterDiscoveredTargets(targets, '', [])).toEqual([]);
  });
});
