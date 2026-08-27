import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import {
  filterDiscoveredTargets,
  isDefaultDiscoverableTarget,
  searchCatalogueTargets,
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
    ...(objectType === '*' || id === 'UNKNOWN_SIZE'
      ? {}
      : { majorAxisArcminutes: 10 }),
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
  rankedTarget('UNKNOWN_SIZE', 'G', { messier: [], ngc: [], ic: [] }),
];

targets[0]!.target.preferredName = 'Andromeda Galaxy';
targets[0]!.target.aliases = ['Andromeda', 'Great Andromeda Galaxy'];

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

  it('matches popular names and aliases with the same search as catalogue numbers', () => {
    expect(
      filterDiscoveredTargets(targets, 'andromeda', allCategories).map(
        ({ target }) => target.id,
      ),
    ).toEqual(['NGC0224']);
    expect(
      filterDiscoveredTargets(targets, 'great-andromeda', allCategories).map(
        ({ target }) => target.id,
      ),
    ).toEqual(['NGC0224']);
  });

  it('supports independent category selection and hides unrelated types once filtered', () => {
    expect(
      filterDiscoveredTargets(targets, '', ['galaxies', 'starClusters']).map(
        ({ target }) => target.id,
      ),
    ).toEqual(['NGC0224', 'NGC869']);
  });

  it('keeps star-like, unclassified, and size-less rows out of normal discovery', () => {
    expect(filterDiscoveredTargets(targets, '', allCategories)).toHaveLength(3);
    expect(filterDiscoveredTargets(targets, '', [])).toEqual([]);
    expect(isDefaultDiscoverableTarget(targets[3]!.target)).toBe(false);
    expect(isDefaultDiscoverableTarget(targets[4]!.target)).toBe(false);
  });

  it('returns search-only rows only for an explicit bounded direct search', () => {
    expect(
      searchCatalogueTargets(
        targets.map(({ target }) => target),
        '',
      ),
    ).toEqual([]);
    expect(
      searchCatalogueTargets(
        targets.map(({ target }) => target),
        'star1',
      ).map(({ id }) => id),
    ).toEqual(['STAR1']);
    expect(
      searchCatalogueTargets(
        targets.map(({ target }) => target),
        'unknown size',
      ).map(({ id }) => id),
    ).toEqual(['UNKNOWN_SIZE']);
  });
});
