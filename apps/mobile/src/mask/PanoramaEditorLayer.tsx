import {
  Canvas,
  Group,
  ImageShader,
  Skia,
  Vertices,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import {
  projectPanoramaEditorPoint,
  projectPanoramaMeshToEditorViewport,
  type PanoramaEditorViewport,
} from '../sky/panoramaOverlayGeometry';
import { createPlanetariumPanoramaMesh } from '../sky/planetariumPanoramaGeometry';
import type { CanvasSizePixels } from '../sky/projection';

const PanoramaEditorTile = memo(function PanoramaEditorTile({
  canvas,
  tile,
  viewport,
}: {
  canvas: CanvasSizePixels;
  tile: ActivePanoramaTile;
  viewport: PanoramaEditorViewport;
}) {
  const image = useImage(tile.uri);
  const mesh = useMemo(() => createPlanetariumPanoramaMesh(tile), [tile]);
  const projection = useMemo(
    () => projectPanoramaMeshToEditorViewport(mesh, viewport, canvas),
    [canvas, mesh, viewport],
  );
  const textures = useMemo(
    () => mesh.texturePointsPixels.map((point) => vec(point.x, point.y)),
    [mesh.texturePointsPixels],
  );
  const vertices = useMemo(
    () => projection.vertices.map((point) => vec(point.xPixels, point.yPixels)),
    [projection.vertices],
  );
  if (!image || projection.indices.length === 0) return null;
  return (
    <Group>
      <ImageShader image={image} tx="decal" ty="decal" />
      <Vertices
        indices={projection.indices}
        mode="triangles"
        textures={textures}
        vertices={vertices}
      />
    </Group>
  );
});

export function PanoramaEditorLayer({
  canvas,
  tiles,
  viewport,
}: {
  canvas: CanvasSizePixels;
  tiles: readonly ActivePanoramaTile[];
  viewport: PanoramaEditorViewport;
}) {
  const hemisphereClip = useMemo(() => {
    const center = projectPanoramaEditorPoint({ x: 0, y: 0 }, viewport, canvas);
    const path = Skia.Path.Make();
    path.addCircle(
      center.xPixels,
      center.yPixels,
      canvas.widthPixels / viewport.horizontalSpan,
    );
    return path;
  }, [canvas, viewport]);
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Group clip={hemisphereClip}>
        {tiles.map((tile) => (
          <PanoramaEditorTile
            canvas={canvas}
            key={tile.id}
            tile={tile}
            viewport={viewport}
          />
        ))}
      </Group>
    </Canvas>
  );
}
