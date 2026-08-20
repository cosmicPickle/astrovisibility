import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import {
  equatorialJ2000ToHorizontal,
  type ObserverLocation,
} from '../astronomy/horizontalCoordinates';
import type { HorizontalCatalogueTarget } from './planetariumCatalogue';

export interface CatalogueProjectionContext {
  observer: ObserverLocation;
  timestampUtc: string;
}

export const projectCatalogueAtInstant = (
  targets: readonly CatalogueTarget[],
  context: CatalogueProjectionContext,
): HorizontalCatalogueTarget[] => {
  const projectedTargets: HorizontalCatalogueTarget[] = [];
  for (const target of targets) {
    const horizontal = equatorialJ2000ToHorizontal({
      rightAscensionJ2000Hours: target.rightAscensionJ2000Hours,
      declinationJ2000Degrees: target.declinationJ2000Degrees,
      observer: context.observer,
      timestampUtc: context.timestampUtc,
    });
    projectedTargets.push({
      altitudeDegrees: horizontal.refractedAltitudeDegrees,
      azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
      target,
    });
  }
  return projectedTargets;
};
