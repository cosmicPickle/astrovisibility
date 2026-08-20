import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type {
  SelectedTargetTrajectory,
  TrajectoryMarker,
} from '../astronomy/trajectory';
import type { VisibilityMask } from '../mask/visibilityMask';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import { colors } from '../theme/tokens';
import {
  queryCataloguePlanetarium,
  type HorizontalCatalogueTarget,
} from './catalogueViewport';
import {
  createPlanetariumCamera,
  createPlanetariumInspectionCamera,
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
  fieldOfViewEquipment: EquipmentRecord | null;
  onInspectTrajectoryMarker: (marker: TrajectoryMarker) => void;
  onSelectTarget: (target: HorizontalCatalogueTarget) => void;
  selectedDirection: {
    altitudeDegrees: number;
    azimuthDegrees: number;
  } | null;
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

const initialCamera = createPlanetariumCamera({
  centerAltitudeDegrees: 45,
  centerAzimuthDegrees: 180,
  fieldOfViewDegrees: 180,
});

export const SkyCanvas = ({
  celestialEquatorDirections,
  fieldOfViewEquipment,
  onInspectTrajectoryMarker,
  onSelectTarget,
  selectedDirection,
  selectedTargetId,
  targets,
  trajectory,
  panoramaOverlay,
  maskOverlay,
}: SkyCanvasProps) => {
  const [canvas, setCanvas] = useState({ widthPixels: 1, heightPixels: 1 });
  const [cameraState, setCameraState] =
    useState<PlanetariumCamera>(initialCamera);
  const selectionFitRef = useRef<{
    directionFitted: boolean;
    manuallyNavigated: boolean;
    targetId: string | null;
    trajectoryFitted: boolean;
  }>({
    directionFitted: false,
    manuallyNavigated: false,
    targetId: null,
    trajectoryFitted: false,
  });

  const visibleTargets = useMemo(
    () => queryCataloguePlanetarium(targets, cameraState, canvas),
    [canvas, cameraState, targets],
  );

  useEffect(() => {
    if (!selectedTargetId) {
      selectionFitRef.current.targetId = null;
      return;
    }
    if (selectionFitRef.current.targetId !== selectedTargetId) {
      selectionFitRef.current = {
        directionFitted: false,
        manuallyNavigated: false,
        targetId: selectedTargetId,
        trajectoryFitted: false,
      };
    }
    const fit = selectionFitRef.current;
    if (
      fit.manuallyNavigated ||
      (trajectory ? fit.trajectoryFitted : fit.directionFitted)
    ) {
      return;
    }
    const trajectoryDirections =
      trajectory?.samples
        .filter(({ assessment }) => assessment !== 'belowHorizon')
        .map((sample) => ({
          altitudeDegrees: sample.refractedAltitudeDegrees,
          azimuthDegrees: sample.azimuthDegreesClockwiseFromNorth,
        })) ?? [];
    const inspectionCamera =
      createPlanetariumInspectionCamera(trajectoryDirections);
    const nextCamera = inspectionCamera
      ? inspectionCamera
      : selectedDirection
        ? createPlanetariumCamera({
            centerAltitudeDegrees: selectedDirection.altitudeDegrees,
            centerAzimuthDegrees: selectedDirection.azimuthDegrees,
            fieldOfViewDegrees: 60,
          })
        : null;
    if (!nextCamera) return;
    if (trajectory) fit.trajectoryFitted = true;
    else fit.directionFitted = true;
    const timeoutId = setTimeout(() => {
      setCameraState(nextCamera);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [selectedDirection, selectedTargetId, trajectory]);

  const markManualNavigation = useCallback(() => {
    selectionFitRef.current.manuallyNavigated = true;
  }, []);

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
    onManualNavigation: markManualNavigation,
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
            equipment={fieldOfViewEquipment}
            mask={maskOverlay?.visible ? maskOverlay.mask : null}
            maskOpacity={(maskOverlay?.opacityPercent ?? 0) / 100}
            panoramaOpacity={(panoramaOverlay?.opacityPercent ?? 0) / 100}
            panoramaTiles={
              panoramaOverlay?.visible ? panoramaOverlay.tiles : []
            }
            selectedDirection={selectedDirection}
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
