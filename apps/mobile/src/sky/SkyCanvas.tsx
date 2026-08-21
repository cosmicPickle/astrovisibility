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
  buildPlanetariumCatalogueIndex,
  layoutPlanetariumTargetLabels,
  selectPlanetariumResidentTargets,
  shouldRefreshPlanetariumResidentCatalogue,
  type HorizontalCatalogueTarget,
} from './planetariumCatalogue';
import {
  createInitialPlanetariumCamera,
  projectHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';
import { PlanetariumScene } from './PlanetariumScene';
import { useLatestValue } from './useLatestValue';
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
    panorama?: ActivePanorama;
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
  const [initialCameraState] = useState<PlanetariumCamera>(() =>
    createInitialPlanetariumCamera(),
  );
  const [residentCameraState, setResidentCameraState] =
    useState(initialCameraState);
  const [labelCameraState, setLabelCameraState] = useState(initialCameraState);
  const catalogueIndex = useMemo(
    () => buildPlanetariumCatalogueIndex(targets),
    [targets],
  );
  const residentTargets = useMemo(
    () =>
      selectPlanetariumResidentTargets(
        catalogueIndex,
        residentCameraState,
        canvas,
        { selectedTargetId },
      ),
    [canvas, catalogueIndex, residentCameraState, selectedTargetId],
  );

  const visibleTargets = useMemo(
    () =>
      layoutPlanetariumTargetLabels(residentTargets, labelCameraState, canvas, {
        selectedTargetId,
      }),
    [canvas, labelCameraState, residentTargets, selectedTargetId],
  );

  const getTapContext = useLatestValue(
    useMemo(
      () => ({
        canvas,
        onInspectTrajectoryMarker,
        onSelectTarget,
        trajectory,
        visibleTargets,
      }),
      [
        canvas,
        onInspectTrajectoryMarker,
        onSelectTarget,
        trajectory,
        visibleTargets,
      ],
    ),
  );

  const handleTap = useCallback(
    (xPixels: number, yPixels: number, tapCamera: PlanetariumCamera) => {
      const {
        canvas: latestCanvas,
        onInspectTrajectoryMarker: inspectTrajectoryMarker,
        onSelectTarget: selectTarget,
        trajectory: latestTrajectory,
        visibleTargets: latestVisibleTargets,
      } = getTapContext();
      const markerMatch = latestTrajectory?.markers
        .filter(({ assessment }) => assessment !== 'belowHorizon')
        .map((marker) => {
          const point = projectHorizontalDirection(
            {
              altitudeDegrees: marker.refractedAltitudeDegrees,
              azimuthDegrees: marker.azimuthDegreesClockwiseFromNorth,
            },
            tapCamera,
            latestCanvas,
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
        inspectTrajectoryMarker(markerMatch.marker);
        return;
      }
      const targetMatch = latestVisibleTargets
        .filter(({ altitudeDegrees }) => altitudeDegrees >= 0)
        .map((target) => {
          const point = projectHorizontalDirection(
            target,
            tapCamera,
            latestCanvas,
          );
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
        selectTarget(targetMatch.target);
      }
    },
    [getTapContext],
  );

  const handleCameraCommit = useCallback((camera: PlanetariumCamera) => {
    setResidentCameraState((anchorCamera) =>
      shouldRefreshPlanetariumResidentCatalogue(anchorCamera, camera)
        ? camera
        : anchorCamera,
    );
    setLabelCameraState(camera);
  }, []);
  const handleCameraPreview = useCallback((camera: PlanetariumCamera) => {
    setResidentCameraState((anchorCamera) =>
      shouldRefreshPlanetariumResidentCatalogue(anchorCamera, camera)
        ? camera
        : anchorCamera,
    );
  }, []);
  const navigation = usePlanetariumNavigation({
    cameraState: initialCameraState,
    canvas,
    onCameraCommit: handleCameraCommit,
    onCameraPreview: handleCameraPreview,
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
            panoramaImage={
              panoramaOverlay?.visible ? panoramaOverlay.panorama : null
            }
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
