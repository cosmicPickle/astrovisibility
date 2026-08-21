import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { PanoramaCaptureDraft } from '../storage/panoramaDraftRepository';
import { PlanetariumScene } from '../sky/PlanetariumScene';
import {
  createInitialPlanetariumCamera,
  unprojectCanvasPoint,
  type PlanetariumCamera,
} from '../sky/planetariumProjection';
import { usePlanetariumNavigation } from '../sky/usePlanetariumNavigation';
import { useLatestValue } from '../sky/useLatestValue';
import type { PanoramaAlignmentAtlasProps } from './PanoramaAlignmentScreen';

const angularDistanceDegrees = (
  left: { altitudeDegrees: number; azimuthDegrees: number },
  right: { altitudeDegrees: number; azimuthDegrees: number },
) => {
  const toRadians = Math.PI / 180;
  const leftAltitude = left.altitudeDegrees * toRadians;
  const rightAltitude = right.altitudeDegrees * toRadians;
  const cosine =
    Math.sin(leftAltitude) * Math.sin(rightAltitude) +
    Math.cos(leftAltitude) *
      Math.cos(rightAltitude) *
      Math.cos((left.azimuthDegrees - right.azimuthDegrees) * toRadians);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / toRadians;
};

const asSceneTile = (tile: PanoramaCaptureDraft['tiles'][number]) => ({
  id: tile.id,
  uri: tile.uri,
  widthPixels: tile.widthPixels,
  heightPixels: tile.heightPixels,
  centerAzimuthDegrees: tile.reviewedPlacement.centerAzimuthDegrees,
  centerAltitudeDegrees: tile.reviewedPlacement.centerAltitudeDegrees,
  rollDegrees: tile.reviewedPlacement.rollDegrees,
  horizontalFieldOfViewDegrees:
    tile.reviewedPlacement.horizontalFieldOfViewDegrees,
  verticalFieldOfViewDegrees: tile.reviewedPlacement.verticalFieldOfViewDegrees,
  coveragePolygon: tile.coveragePolygon,
});

export function PanoramaAlignmentAtlas({
  onSelectTile,
  selectedTileId,
  tiles,
}: PanoramaAlignmentAtlasProps) {
  const [canvas, setCanvas] = useState({ heightPixels: 1, widthPixels: 1 });
  const [initialCamera] = useState<PlanetariumCamera>(() =>
    createInitialPlanetariumCamera(),
  );
  const sceneTiles = useMemo(() => tiles.map(asSceneTile), [tiles]);
  const getTapContext = useLatestValue({ canvas, onSelectTile, tiles });
  const handleTap = useCallback(
    (xPixels: number, yPixels: number, camera: PlanetariumCamera) => {
      const context = getTapContext();
      const direction = unprojectCanvasPoint(
        { xPixels, yPixels },
        camera,
        context.canvas,
      );
      if (!direction || direction.altitudeDegrees < 0) return;
      const match = context.tiles
        .map((tile) => ({
          distance: angularDistanceDegrees(direction, {
            altitudeDegrees: tile.reviewedPlacement.centerAltitudeDegrees,
            azimuthDegrees: tile.reviewedPlacement.centerAzimuthDegrees,
          }),
          tile,
        }))
        .filter(
          ({ distance, tile }) =>
            distance <=
            Math.hypot(
              tile.reviewedPlacement.horizontalFieldOfViewDegrees,
              tile.reviewedPlacement.verticalFieldOfViewDegrees,
            ) /
              2,
        )
        .sort((left, right) => left.distance - right.distance)[0];
      if (match) context.onSelectTile(match.tile.id);
    },
    [getTapContext],
  );
  const navigation = usePlanetariumNavigation({
    cameraState: initialCamera,
    canvas,
    onCameraCommit: () => undefined,
    onCameraPreview: () => undefined,
    onTap: handleTap,
  });
  const handleLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (height > 0 && width > 0)
      setCanvas({ heightPixels: height, widthPixels: width });
  };

  return (
    <View
      accessibilityLabel="Gesture-controlled spherical tile alignment atlas"
      onLayout={handleLayout}
      style={styles.container}
    >
      <GestureDetector gesture={navigation.gesture}>
        <View style={styles.container}>
          <PlanetariumScene
            camera={navigation.camera}
            canvas={canvas}
            celestialEquatorDirections={[]}
            diurnalOrbit={null}
            equipment={null}
            mask={null}
            maskOpacity={0}
            panoramaOpacity={1}
            panoramaTiles={sceneTiles}
            selectedPanoramaTileId={selectedTileId}
            selectedTargetId={null}
            targets={[]}
            trajectory={null}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
