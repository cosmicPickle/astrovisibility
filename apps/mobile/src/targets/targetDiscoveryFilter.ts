import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type { RankedTarget } from './rankedTargetCalculation';

export type TargetCategory = 'galaxies' | 'nebulae' | 'starClusters';

const categoryTypes: Readonly<Record<TargetCategory, ReadonlySet<string>>> = {
  galaxies: new Set(['G', 'GPair', 'GTrpl', 'GGroup', 'Galaxy']),
  nebulae: new Set(['PN', 'Neb', 'HII', 'RfN', 'SNR', 'EmN', 'Nebula']),
  starClusters: new Set(['OCl', 'GCl', 'Cl+N', '*Ass', 'Star Cluster']),
};

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

const categoryForTarget = (target: CatalogueTarget): TargetCategory | null => {
  for (const category of Object.keys(categoryTypes) as TargetCategory[]) {
    if (categoryTypes[category].has(target.objectType)) return category;
  }
  return null;
};

export const filterDiscoveredTargets = (
  targets: readonly RankedTarget[],
  catalogueSearch: string,
  selectedCategories: readonly TargetCategory[],
): RankedTarget[] => {
  if (selectedCategories.length === 0) return [];
  const selected = new Set(selectedCategories);
  const allCategoriesSelected =
    selected.size === Object.keys(categoryTypes).length;
  const normalizedSearch = normalizeCatalogueIdentifier(catalogueSearch);
  return targets.filter(({ target }) => {
    const category = categoryForTarget(target);
    if (category ? !selected.has(category) : !allCategoriesSelected)
      return false;
    return (
      normalizedSearch.length === 0 ||
      catalogueIdentifiersFor(target).some((identifier) =>
        identifier.includes(normalizedSearch),
      )
    );
  });
};
