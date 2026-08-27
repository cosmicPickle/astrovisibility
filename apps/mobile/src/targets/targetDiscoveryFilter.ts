import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type { RankedTarget } from './rankedTargetCalculation';

export type TargetCategory = 'galaxies' | 'nebulae' | 'starClusters';

const categoryTypes: Readonly<Record<TargetCategory, ReadonlySet<string>>> = {
  galaxies: new Set(['G', 'GPair', 'GTrpl', 'GGroup', 'Galaxy']),
  nebulae: new Set(['PN', 'Neb', 'HII', 'RfN', 'SNR', 'EmN', 'DrkN', 'Nebula']),
  starClusters: new Set(['OCl', 'GCl', 'Cl+N', '*Ass', 'Star Cluster']),
};

export const ALL_TARGET_CATEGORIES: readonly TargetCategory[] = [
  'galaxies',
  'nebulae',
  'starClusters',
];

const normalizeCatalogueIdentifier = (value: string): string => {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return compact.replace(/^(NGC|IC|M|C)0+(\d+)$/, '$1$2');
};

const catalogueIdentifiersFor = (target: CatalogueTarget): string[] => {
  const identifiers = [
    target.id,
    ...target.memberships.messier.map((number) => `M${number}`),
    ...target.memberships.ngc,
    ...target.memberships.ic,
    ...(target.memberships.caldwell === undefined
      ? []
      : [`C${target.memberships.caldwell}`]),
  ].map(normalizeCatalogueIdentifier);
  return [
    ...identifiers,
    ...identifiers.flatMap((identifier) => {
      const number = identifier.match(/\d+$/)?.[0];
      return number ? [number] : [];
    }),
  ];
};

export const categoryForTarget = (
  target: CatalogueTarget,
): TargetCategory | null => {
  for (const category of Object.keys(categoryTypes) as TargetCategory[]) {
    if (categoryTypes[category].has(target.objectType)) return category;
  }
  return null;
};

const searchableValuesFor = (target: CatalogueTarget): string[] => [
  ...catalogueIdentifiersFor(target),
  normalizeCatalogueIdentifier(target.preferredName),
  ...target.aliases.map(normalizeCatalogueIdentifier),
];

export const targetMatchesSearch = (
  target: CatalogueTarget,
  searchText: string,
): boolean => {
  const normalizedSearch = normalizeCatalogueIdentifier(searchText);
  return (
    normalizedSearch.length === 0 ||
    searchableValuesFor(target).some((value) =>
      value.includes(normalizedSearch),
    )
  );
};

export const isDefaultDiscoverableTarget = (target: CatalogueTarget): boolean =>
  categoryForTarget(target) !== null &&
  target.majorAxisArcminutes !== undefined &&
  Number.isFinite(target.majorAxisArcminutes) &&
  target.majorAxisArcminutes > 0;

export const targetMatchesCategories = (
  target: CatalogueTarget,
  selectedCategories: readonly TargetCategory[],
): boolean => {
  const category = categoryForTarget(target);
  return category !== null && selectedCategories.includes(category);
};

export const filterCatalogueForDiscovery = (
  targets: readonly CatalogueTarget[],
  searchText: string,
  selectedCategories: readonly TargetCategory[],
): CatalogueTarget[] =>
  targets.filter(
    (target) =>
      isDefaultDiscoverableTarget(target) &&
      targetMatchesCategories(target, selectedCategories) &&
      targetMatchesSearch(target, searchText),
  );

const searchRank = (target: CatalogueTarget, normalizedSearch: string) => {
  const values = searchableValuesFor(target);
  if (values.some((value) => value === normalizedSearch)) return 0;
  if (values.some((value) => value.startsWith(normalizedSearch))) return 1;
  return 2;
};

export const searchCatalogueTargets = (
  targets: readonly CatalogueTarget[],
  searchText: string,
  limit = 50,
): CatalogueTarget[] => {
  const normalizedSearch = normalizeCatalogueIdentifier(searchText);
  if (normalizedSearch.length === 0) return [];
  return targets
    .filter((target) => targetMatchesSearch(target, searchText))
    .sort(
      (left, right) =>
        searchRank(left, normalizedSearch) -
          searchRank(right, normalizedSearch) ||
        left.prominenceTier - right.prominenceTier ||
        left.preferredName.localeCompare(right.preferredName) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, Math.max(0, limit));
};

export const filterDiscoveredTargets = (
  targets: readonly RankedTarget[],
  catalogueSearch: string,
  selectedCategories: readonly TargetCategory[],
): RankedTarget[] => {
  return targets.filter(({ target }) => {
    return (
      isDefaultDiscoverableTarget(target) &&
      targetMatchesCategories(target, selectedCategories) &&
      targetMatchesSearch(target, catalogueSearch)
    );
  });
};
