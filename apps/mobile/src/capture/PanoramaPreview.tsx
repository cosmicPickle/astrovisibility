import { useState } from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { StitchedPreview } from '../panorama/panoramaStitching';
import { PlanetariumScene } from '../sky/PlanetariumScene';
import { createPlanetariumCamera } from '../sky/planetariumProjection';
import { usePlanetariumNavigation } from '../sky/usePlanetariumNavigation';

export function PanoramaPreview({ preview }: { preview: StitchedPreview }) {
  const [canvas, setCanvas] = useState({ widthPixels: 1, heightPixels: 1 });
  const [cameraState] = useState(() =>
    createPlanetariumCamera({
      centerAltitudeDegrees: preview.centerAltitudeDegrees,
      centerAzimuthDegrees: preview.centerAzimuthDegrees,
      fieldOfViewDegrees: 100,
    }),
  );
  const navigation = usePlanetariumNavigation({
    cameraState,
    canvas,
    onCameraCommit: () => undefined,
    onCameraPreview: () => undefined,
    onTap: () => undefined,
  });
  return (
    <View
      accessibilityLabel="Stitched panorama preview"
      style={{ flex: 1 }}
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width > 0 && layout.height > 0)
          setCanvas({ widthPixels: layout.width, heightPixels: layout.height });
      }}
    >
      <GestureDetector gesture={navigation.gesture}>
        <View style={{ flex: 1 }}>
          <PlanetariumScene
            camera={navigation.camera}
            canvas={canvas}
            celestialEquatorDirections={[]}
            diurnalOrbit={null}
            equipment={null}
            fieldOfViewRotationDegrees={0}
            mask={null}
            maskOpacity={0}
            panoramaOpacity={1}
            panoramaImage={preview.panorama}
            panoramaTiles={[]}
            selectedTargetId={null}
            targets={[]}
            trajectory={null}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
