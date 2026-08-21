import {
  Canvas,
  Group,
  Image,
  Skia,
  useImage,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import {
  projectPanoramaEditorPoint,
  type PanoramaEditorViewport,
} from '../sky/panoramaOverlayGeometry';
import type { CanvasSizePixels } from '../sky/projection';

export function projectDirectionalAtlasRect(
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
) {
  const topLeft = projectPanoramaEditorPoint(
    { x: -1, y: -1 },
    viewport,
    canvas,
  );
  const bottomRight = projectPanoramaEditorPoint(
    { x: 1, y: 1 },
    viewport,
    canvas,
  );
  return {
    height: bottomRight.yPixels - topLeft.yPixels,
    width: bottomRight.xPixels - topLeft.xPixels,
    x: topLeft.xPixels,
    y: topLeft.yPixels,
  };
}

export function PanoramaEditorLayer({
  canvas,
  panorama,
  viewport,
}: {
  canvas: CanvasSizePixels;
  panorama: ActivePanorama;
  viewport: PanoramaEditorViewport;
}) {
  const image = useImage(panorama.uri ?? null);
  const destination = useMemo(
    () => projectDirectionalAtlasRect(viewport, canvas),
    [canvas, viewport],
  );
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
  if (!image) return null;
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Group clip={hemisphereClip}>
        <Image
          fit="fill"
          height={destination.height}
          image={image}
          width={destination.width}
          x={destination.x}
          y={destination.y}
        />
      </Group>
    </Canvas>
  );
}
