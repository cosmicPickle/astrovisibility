import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type {
  SelectedTargetTrajectory,
  TrajectoryMarker,
} from '../astronomy/trajectory';
import type { TargetDiurnalOrbit } from '../astronomy/diurnalTrajectory';
import type { VisibilityMask } from '../mask/visibilityMask';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import { colors } from '../theme/tokens';
import {
  queryCataloguePlanetarium,
  type HorizontalCatalogueTarget,
} from './catalogueViewport';
import {
  createLocalHorizonOverviewCamera,
  projectHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';
import { PlanetariumScene } from './PlanetariumScene';
import { usePlanetariumNavigation } from './usePlanetariumNavigation';

export const TRAJECTORY_MARKER_HIT_RADIUS_PIXELS = 22;

export interface SkyCanvasProps {
  celestialEquatorDirections: readonly {
    altitudeDegrees: number;
    azimuthDegrees: number;
  }[];
  diurnalOrbit: TargetDiurnalOrbit | null;
  fieldOfViewEquipment: EquipmentRecord | null;
  onInspectTrajectoryMarker: (marker: TrajectoryMarker) => void;
  onSelectTarget: (target: HorizontalCatalogueTarget) => void;
  selectedTargetId: string | null;
  targets: readonly HorizontalCatalogueTarget[];
  trajectory: SelectedTargetTrajectory | null;
  panoramaOverlay: {
    tiles: ActivePanorama['tiles'];
    opacityPercent: number;
    visible: boolean;
  } | null;
  maskOverlay: {
    mask: VisibilityMask;
    opacityPercent: number;
    visible: boolean;
  } | null;
}

export const SkyCanvas = ({
  celestialEquatorDirections,
  diurnalOrbit,
  fieldOfViewEquipment,
  onInspectTrajectoryMarker,
  onSelectTarget,
  selectedTargetId,
  targets,
  trajectory,
  panoramaOverlay,
  maskOverlay,
}: SkyCanvasProps) => {
  const [canvas, setCanvas] = useState({ widthPixels: 1, heightPixels: 1 });
  const [cameraState, setCameraState] = useState<PlanetariumCamera>(() =>
    createLocalHorizonOverviewCamera(),
  );

  const visibleTargets = useMemo(
    () => queryCataloguePlanetarium(targets, cameraState, canvas),
    [canvas, cameraState, targets],
  );

  const handleTap = useCallback(
    (xPixels: number, yPixels: number, tapCamera: PlanetariumCamera) => {
      const markerMatch = trajectory?.markers
        .filter(({ assessment }) => assessment !== 'belowHorizon')
        .map((marker) => {
          const point = projectHorizontalDirection(
            {
              altitudeDegrees: marker.refractedAltitudeDegrees,
              azimuthDegrees: marker.azimuthDegreesClockwiseFromNorth,
            },
            tapCamera,
            canvas,
          );
          return {
            distancePixels: Math.hypot(
              point.xPixels - xPixels,
              point.yPixels - yPixels,
            ),
            marker,
            point,
          };
        })
        .filter(({ point }) => point.visible)
        .sort((left, right) => left.distancePixels - right.distancePixels)[0];
      if (
        markerMatch &&
        markerMatch.distancePixels <= TRAJECTORY_MARKER_HIT_RADIUS_PIXELS
      ) {
        onInspectTrajectoryMarker(markerMatch.marker);
        return;
      }
      const targetMatch = visibleTargets
        .filter(({ altitudeDegrees }) => altitudeDegrees >= 0)
        .map((target) => {
          const point = projectHorizontalDirection(target, tapCamera, canvas);
          return {
            distancePixels: Math.hypot(
              point.xPixels - xPixels,
              point.yPixels - yPixels,
            ),
            point,
            target,
          };
        })
        .filter(({ point }) => point.visible)
        .sort((left, right) => left.distancePixels - right.distancePixels)[0];
      if (
        targetMatch &&
        targetMatch.distancePixels <= targetMatch.target.hitRadiusPixels
      ) {
        onSelectTarget(targetMatch.target);
      }
    },
    [
      canvas,
      onInspectTrajectoryMarker,
      onSelectTarget,
      trajectory,
      visibleTargets,
    ],
  );

  const handleCameraCommit = useCallback((camera: PlanetariumCamera) => {
    setCameraState(camera);
  }, []);
  const navigation = usePlanetariumNavigation({
    cameraState,
    canvas,
    onCameraCommit: handleCameraCommit,
    onTap: handleTap,
  });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvas({ widthPixels: width, heightPixels: height });
    }
  }, []);

  return (
    <View onLayout={handleLayout} style={styles.container}>
      <GestureDetector gesture={navigation.gesture}>
        <View
          accessibilityLabel={`${visibleTargets.filter(({ labelVisible }) => labelVisible).length} deep-sky targets in the current spherical sky view`}
          accessible
          style={styles.scene}
        >
          <PlanetariumScene
            camera={navigation.camera}
            canvas={canvas}
            celestialEquatorDirections={celestialEquatorDirections}
            diurnalOrbit={diurnalOrbit}
            equipment={fieldOfViewEquipment}
            mask={maskOverlay?.visible ? maskOverlay.mask : null}
            maskOpacity={(maskOverlay?.opacityPercent ?? 0) / 100}
            panoramaOpacity={(panoramaOverlay?.opacityPercent ?? 0) / 100}
            panoramaTiles={
              panoramaOverlay?.visible ? panoramaOverlay.tiles : []
            }
            selectedTargetId={selectedTargetId}
            targets={visibleTargets}
            trajectory={trajectory}
          />
        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backdrop,
    flex: 1,
    overflow: 'hidden',
  },
  scene: {
    flex: 1,
  },
});
