import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import {
  buildHorizontalSpatialIndex,
  getSecondaryCatalogueLabel,
  getProminenceTierLimit,
  queryCataloguePlanetarium,
  queryCatalogueViewport,
  shouldRefreshPlanetariumCatalogue,
  type HorizontalCatalogueTarget,
} from './catalogueViewport';
import { createSkyViewport } from './skyViewport';
import { createPlanetariumCamera } from './planetariumProjection';

const canvas = { widthPixels: 400, heightPixels: 800 };

function target(
  id: string,
  azimuthDegrees: number,
  altitudeDegrees: number,
  prominenceTier: 1 | 2 | 3 | 4,
  preferredName = id,
): HorizontalCatalogueTarget {
  const catalogueTarget: CatalogueTarget = {
    id,
    preferredName,
    aliases: [id],
    rightAscensionJ2000Hours: 0,
    declinationJ2000Degrees: 0,
    constellation: 'Ori',
    objectType: 'G',
    majorAxisArcminutes: 60,
    minorAxisArcminutes: 30,
    positionAngleDegrees: 20,
    magnitude: 5,
    memberships: { messier: [], ngc: [], ic: [] },
    prominenceTier,
  };
  return { altitudeDegrees, azimuthDegrees, target: catalogueTarget };
}

describe('catalogue viewport query', () => {
  it('reveals progressively deeper prominence tiers as the user zooms', () => {
    expect(getProminenceTierLimit(360)).toBe(1);
    expect(getProminenceTierLimit(160)).toBe(2);
    expect(getProminenceTierLimit(75)).toBe(3);
    expect(getProminenceTierLimit(30)).toBe(4);
  });

  it('queries wrapped spatial bins without mounting the whole catalogue', () => {
    const targets = [
      target('west-of-north', 358, 60, 1),
      target('east-of-north', 2, 42, 1),
      ...Array.from({ length: 500 }, (_, index) =>
        target(`background-${index}`, 120 + (index % 30), 20, 4),
      ),
    ];
    const index = buildHorizontalSpatialIndex(targets);
    const visible = queryCatalogueViewport(
      index,
      createSkyViewport({
        centerAltitudeDegrees: 45,
        centerAzimuthDegrees: 0,
        horizontalSpanDegrees: 40,
      }),
      canvas,
    );

    expect(visible.map((item) => item.target.id)).toEqual([
      'east-of-north',
      'west-of-north',
    ]);
    expect(visible.length).toBeLessThan(targets.length);
  });

  it('can retain a bounded offscreen buffer for continuous gesture navigation', () => {
    const index = buildHorizontalSpatialIndex([
      target('onscreen', 180, 45, 1),
      target('buffered-west', 120, 45, 1),
    ]);
    const viewport = createSkyViewport({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      horizontalSpanDegrees: 90,
    });

    expect(
      queryCatalogueViewport(index, viewport, canvas).map(
        (item) => item.target.id,
      ),
    ).toEqual(['onscreen']);
    const buffered = queryCatalogueViewport(index, viewport, canvas, {
      overscanRatio: 0.5,
    });
    expect(buffered.map((item) => item.target.id)).toEqual([
      'buffered-west',
      'onscreen',
    ]);
    expect(buffered[0]!.xPixels).toBeLessThan(0);
    expect(buffered[0]!.labelVisible).toBe(false);
    expect(buffered[1]!.labelVisible).toBe(true);
    expect(buffered).toHaveLength(2);
  });

  it('leads with common names and suppresses colliding labels deterministically', () => {
    const index = buildHorizontalSpatialIndex([
      target('NGC1976', 180, 45, 1, 'Orion Nebula'),
      target('NGC1977', 180.2, 45.1, 2, 'Running Man Nebula'),
      target('NGC224', 210, 55, 1, 'Andromeda Galaxy'),
    ]);
    const visible = queryCatalogueViewport(
      index,
      createSkyViewport({
        centerAltitudeDegrees: 45,
        centerAzimuthDegrees: 180,
        horizontalSpanDegrees: 90,
      }),
      canvas,
    );

    expect(visible.map((item) => item.target.preferredName)).toEqual([
      'Andromeda Galaxy',
      'Orion Nebula',
    ]);
    expect(visible.every((item) => item.label.length > 0)).toBe(true);
  });

  it('uses a concise catalogue membership instead of an arbitrary long alias', () => {
    const catalogueTarget = target(
      'NGC1976',
      180,
      45,
      1,
      'Orion Nebula',
    ).target;
    catalogueTarget.aliases = ['2MASS J0535-0523', 'M 42', 'NGC 1976'];
    catalogueTarget.memberships.messier = [42];
    catalogueTarget.memberships.ngc = ['NGC 1976'];
    expect(getSecondaryCatalogueLabel(catalogueTarget)).toBe('M 42');
  });

  it('converts angular axes to honest screen dimensions with a separate hit radius', () => {
    const index = buildHorizontalSpatialIndex([
      target('large', 180, 45, 1, 'Large target'),
    ]);
    const [visible] = queryCatalogueViewport(
      index,
      createSkyViewport({
        centerAltitudeDegrees: 45,
        centerAzimuthDegrees: 180,
        horizontalSpanDegrees: 20,
      }),
      canvas,
    );

    expect(visible?.outlineWidthPixels).toBeCloseTo(20);
    expect(visible?.outlineHeightPixels).toBeCloseTo(10);
    expect(visible?.hitRadiusPixels).toBeGreaterThanOrEqual(22);
    expect(visible?.outlineWidthPixels).toBeLessThan(
      (visible?.hitRadiusPixels ?? 0) * 2,
    );
  });
});

describe('planetarium catalogue query', () => {
  it('keeps an overscanned catalogue anchor stable across small pan and zoom release deltas', () => {
    const anchor = createPlanetariumCamera({
      centerAltitudeDegrees: 35,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 100,
    });
    const smallPan = createPlanetariumCamera({
      centerAltitudeDegrees: 35,
      centerAzimuthDegrees: 12,
      fieldOfViewDegrees: 100,
    });
    const substantialPan = createPlanetariumCamera({
      centerAltitudeDegrees: 35,
      centerAzimuthDegrees: 28,
      fieldOfViewDegrees: 100,
    });
    const smallZoom = createPlanetariumCamera({
      centerAltitudeDegrees: 35,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 92,
    });
    const substantialZoom = createPlanetariumCamera({
      centerAltitudeDegrees: 35,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 78,
    });

    expect(shouldRefreshPlanetariumCatalogue(anchor, smallPan)).toBe(false);
    expect(shouldRefreshPlanetariumCatalogue(anchor, smallZoom)).toBe(false);
    expect(shouldRefreshPlanetariumCatalogue(anchor, substantialPan)).toBe(
      true,
    );
    expect(shouldRefreshPlanetariumCatalogue(anchor, substantialZoom)).toBe(
      true,
    );
  });

  it('retains north-wrapped targets in the live gesture buffer', () => {
    const targets = [
      target('west-of-north', 350, 45, 1),
      target('east-of-north', 10, 45, 1),
      target('south', 180, 45, 1),
    ];
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 40,
    });

    expect(
      queryCataloguePlanetarium(targets, camera, canvas).map(
        (item) => item.target.id,
      ),
    ).toEqual(['east-of-north', 'west-of-north']);
  });

  it('selects the full above-horizon hemisphere at the widest stereographic view', () => {
    const targets = [
      target('north', 0, 15, 1),
      target('east', 90, 30, 1),
      target('south', 180, 45, 1),
      target('west', 270, 60, 1),
    ];
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 90,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 235,
    });

    expect(
      queryCataloguePlanetarium(targets, camera, canvas).map(
        (item) => item.target.id,
      ),
    ).toEqual(['east', 'north', 'south', 'west']);
  });

  it('does not let prominent offscreen targets displace the live atlas', () => {
    const targets = [
      ...Array.from({ length: 120 }, (_, index) =>
        target(`a-offscreen-${index}`, 120, 45, 1),
      ),
      target('z-onscreen', 0, 45, 1),
    ];
    const camera = createPlanetariumCamera({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: 60,
    });

    expect(
      queryCataloguePlanetarium(targets, camera, canvas).map(
        (item) => item.target.id,
      ),
    ).toContain('z-onscreen');
  });
});
