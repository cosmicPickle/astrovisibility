import { createTileCoveragePolygon } from '../panorama/tileGeometry';
import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import {
  createPanoramaEditorViewport,
  directionToPanoramaEditorPoint,
  panoramaEditorPointToDirection,
  projectPanoramaMeshToEditorViewport,
  type PanoramaEditorViewport,
} from './panoramaOverlayGeometry';
import { createPlanetariumPanoramaMesh } from './planetariumPanoramaGeometry';

const canvas = { widthPixels: 360, heightPixels: 180 };
const tile: ActivePanoramaTile = {
  id: 'tile-1',
  uri: 'file:///panorama/tile-1.jpg',
  centerAzimuthDegrees: 0,
  centerAltitudeDegrees: 45,
  rollDegrees: 0,
  horizontalFieldOfViewDegrees: 60,
  verticalFieldOfViewDegrees: 40,
  widthPixels: 1600,
  heightPixels: 1200,
  coveragePolygon: [],
};

const placedTile = (
  overrides: Partial<ActivePanoramaTile>,
): ActivePanoramaTile => {
  const placed = { ...tile, ...overrides };
  return { ...placed, coveragePolygon: createTileCoveragePolygon(placed) };
};

const viewportCenteredOn = (
  direction: { azimuthDegrees: number; altitudeDegrees: number },
  horizontalSpan: number,
): PanoramaEditorViewport => {
  const center = directionToPanoramaEditorPoint(direction);
  return { centerX: center.x, centerY: center.y, horizontalSpan };
};

const maximumTriangleWidth = (
  projection: ReturnType<typeof projectPanoramaMeshToEditorViewport>,
) =>
  Math.max(
    ...Array.from(
      { length: projection.indices.length / 3 },
      (_, triangleIndex) => {
        const indices = projection.indices.slice(
          triangleIndex * 3,
          triangleIndex * 3 + 3,
        );
        const xs = indices.map(
          (vertexIndex) => projection.vertices[vertexIndex]!.xPixels,
        );
        return Math.max(...xs) - Math.min(...xs);
      },
    ),
  );

describe('panorama hemisphere editor projection', () => {
  it('fits a partial panorama instead of opening at a thin full-sky scale', () => {
    const viewport = createPanoramaEditorViewport([
      placedTile({}),
      placedTile({ id: 'tile-2', centerAzimuthDegrees: 55 }),
    ]);

    expect(viewport.horizontalSpan).toBeGreaterThanOrEqual(0.65);
    expect(viewport.horizontalSpan).toBeLessThan(2);
  });

  it('has no discontinuity where azimuth crosses north', () => {
    const viewport = createPanoramaEditorViewport([
      placedTile({ centerAzimuthDegrees: 350 }),
      placedTile({ id: 'tile-2', centerAzimuthDegrees: 10 }),
    ]);

    expect(Math.abs(viewport.centerX)).toBeLessThan(0.2);
    expect(viewport.horizontalSpan).toBeLessThan(2);
  });

  it('fits full horizontal coverage inside the hemisphere disk', () => {
    const viewport = createPanoramaEditorViewport(
      Array.from({ length: 8 }, (_, index) =>
        placedTile({
          id: `tile-${index}`,
          centerAzimuthDegrees: index * 45,
        }),
      ),
    );

    expect(viewport.centerX).toBeCloseTo(0, 1);
    expect(viewport.centerY).toBeCloseTo(0, 1);
    expect(viewport.horizontalSpan).toBeGreaterThan(1.4);
    expect(viewport.horizontalSpan).toBeLessThanOrEqual(2.4);
  });

  it('round-trips horizon, mid-sky, and zenith directions', () => {
    for (const direction of [
      { azimuthDegrees: 0, altitudeDegrees: 0 },
      { azimuthDegrees: 123, altitudeDegrees: 42 },
      { azimuthDegrees: 270, altitudeDegrees: 90 },
    ]) {
      const roundTrip = panoramaEditorPointToDirection(
        directionToPanoramaEditorPoint(direction),
      )!;
      expect(roundTrip.altitudeDegrees).toBeCloseTo(
        direction.altitudeDegrees,
        8,
      );
      if (direction.altitudeDegrees < 90) {
        expect(roundTrip.azimuthDegrees).toBeCloseTo(
          direction.azimuthDegrees,
          8,
        );
      }
    }
  });

  it('warps rectilinear samples and scales them consistently when zooming', () => {
    const placed = placedTile({ centerAzimuthDegrees: 10 });
    const mesh = createPlanetariumPanoramaMesh(placed);
    const wide = projectPanoramaMeshToEditorViewport(
      mesh,
      viewportCenteredOn({ azimuthDegrees: 0, altitudeDegrees: 45 }, 1.2),
      canvas,
    );
    const zoomed = projectPanoramaMeshToEditorViewport(
      mesh,
      viewportCenteredOn({ azimuthDegrees: 0, altitudeDegrees: 45 }, 0.6),
      canvas,
    );
    const centerIndex = Math.floor(mesh.directions.length / 2);
    const wideOffset =
      wide.vertices[centerIndex]!.xPixels - canvas.widthPixels / 2;
    const zoomedOffset =
      zoomed.vertices[centerIndex]!.xPixels - canvas.widthPixels / 2;

    expect(zoomedOffset).toBeCloseTo(wideOffset * 2, 5);
    expect(zoomed.indices).toEqual(wide.indices);
    expect(wide.indices).toEqual(mesh.indices);
  });

  it('keeps north-crossing and zenith-crossing photographs free of slivers', () => {
    for (const placed of [
      placedTile({ centerAzimuthDegrees: 355 }),
      placedTile({ centerAltitudeDegrees: 82, centerAzimuthDegrees: 10 }),
    ]) {
      const projection = projectPanoramaMeshToEditorViewport(
        createPlanetariumPanoramaMesh(placed),
        viewportCenteredOn(
          {
            azimuthDegrees: placed.centerAzimuthDegrees,
            altitudeDegrees: placed.centerAltitudeDegrees,
          },
          0.9,
        ),
        canvas,
      );

      expect(maximumTriangleWidth(projection)).toBeLessThan(
        canvas.widthPixels / 2,
      );
    }
  });
});
