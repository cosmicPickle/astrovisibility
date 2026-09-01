import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type {
  SelectedTargetTrajectory,
  TrajectoryMarker,
  VisibilityInterval,
} from '../astronomy/trajectory';
import type { TargetDiurnalOrbit } from '../astronomy/diurnalTrajectory';
import type { VisibilityMask } from '../mask/visibilityMask';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import { colors } from '../theme/tokens';
import {
  buildPlanetariumCatalogueIndex,
  layoutPlanetariumTargetLabels,
  selectDeterministicAtlasFloorTargetIds,
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
import type { MaskMode } from './MaskAppearanceControls';
import {
  selectRegisteredConstellationLabels,
  selectRegisteredDsoImages,
  selectRegisteredStarBatches,
  selectVisibleRegisteredConstellations,
  type RegisteredDsoImage,
  type RegisteredSkyProjection,
} from './registeredSkyProjection';
import { useLatestValue } from './useLatestValue';
import { usePlanetariumNavigation } from './usePlanetariumNavigation';

export const TRAJECTORY_MARKER_HIT_RADIUS_PIXELS = 22;

export interface SkyCanvasProps {
  astronomicalDarknessIntervals?: readonly VisibilityInterval[];
  celestialEquatorDirections: readonly {
    altitudeDegrees: number;
    azimuthDegrees: number;
  }[];
  densityCandidateCount: number;
  diurnalOrbit: TargetDiurnalOrbit | null;
  fieldOfViewEquipment: EquipmentRecord | null;
  fieldOfViewRotationDegrees: number;
  focusRequest: {
    direction: { altitudeDegrees: number; azimuthDegrees: number };
    id: number;
  } | null;
  onInspectTrajectoryMarker: (marker: TrajectoryMarker) => void;
  onSelectTarget: (target: HorizontalCatalogueTarget) => void;
  selectedTargetId: string | null;
  targets: readonly HorizontalCatalogueTarget[];
  trajectory: SelectedTargetTrajectory | null;
  maskPresentation: {
    color: string;
    mask: VisibilityMask;
    mode: MaskMode;
    opacityPercent: number;
    panorama: ActivePanorama | null;
  } | null;
  minimumTargetCount: number;
  registeredSky: RegisteredSkyProjection;
  registeredDsoImages: readonly RegisteredDsoImage[];
  constellationOpacityPercent: number;
}

export const SkyCanvas = ({
  astronomicalDarknessIntervals = [],
  celestialEquatorDirections,
  densityCandidateCount,
  diurnalOrbit,
  fieldOfViewEquipment,
  fieldOfViewRotationDegrees,
  focusRequest,
  onInspectTrajectoryMarker,
  onSelectTarget,
  selectedTargetId,
  targets,
  trajectory,
  maskPresentation,
  minimumTargetCount,
  registeredSky,
  registeredDsoImages,
  constellationOpacityPercent,
}: SkyCanvasProps) => {
  const [canvas, setCanvas] = useState({ widthPixels: 1, heightPixels: 1 });
  const [initialCameraState] = useState<PlanetariumCamera>(() =>
    createInitialPlanetariumCamera(),
  );
  const [residentCameraState, setResidentCameraState] =
    useState(initialCameraState);
  const [labelCameraState, setLabelCameraState] = useState(initialCameraState);
  const [constellationCameraState, setConstellationCameraState] =
    useState(initialCameraState);
  const catalogueIndex = useMemo(
    () => buildPlanetariumCatalogueIndex(targets),
    [targets],
  );
  const floorTargetIds = useMemo(
    () =>
      selectDeterministicAtlasFloorTargetIds(
        catalogueIndex,
        canvas,
        minimumTargetCount,
      ),
    [canvas, catalogueIndex, minimumTargetCount],
  );
  const residentTargets = useMemo(
    () =>
      selectPlanetariumResidentTargets(
        catalogueIndex,
        residentCameraState,
        canvas,
        {
          densityCandidateCount,
          floorTargetIds,
          minimumTargetCount,
          selectedTargetId,
        },
      ),
    [
      canvas,
      catalogueIndex,
      densityCandidateCount,
      floorTargetIds,
      minimumTargetCount,
      residentCameraState,
      selectedTargetId,
    ],
  );

  const visibleTargets = useMemo(
    () =>
      layoutPlanetariumTargetLabels(residentTargets, labelCameraState, canvas, {
        selectedTargetId,
      }),
    [canvas, labelCameraState, residentTargets, selectedTargetId],
  );
  const registeredStarBatches = useMemo(
    () =>
      selectRegisteredStarBatches(
        registeredSky.stars,
        residentCameraState,
        canvas,
      ),
    [canvas, registeredSky.stars, residentCameraState],
  );
  const visibleRegisteredConstellations = useMemo(
    () =>
      selectVisibleRegisteredConstellations(
        registeredSky.constellations,
        constellationCameraState,
        canvas,
      ),
    [canvas, constellationCameraState, registeredSky.constellations],
  );
  const constellationLabels = useMemo(
    () =>
      selectRegisteredConstellationLabels(
        visibleRegisteredConstellations,
        labelCameraState,
        canvas,
      ),
    [canvas, labelCameraState, visibleRegisteredConstellations],
  );
  const visibleRegisteredSky = useMemo(
    () => ({
      ...registeredSky,
      constellations: visibleRegisteredConstellations,
    }),
    [registeredSky, visibleRegisteredConstellations],
  );
  const visibleRegisteredDsoImages = useMemo(
    () =>
      selectRegisteredDsoImages(
        registeredDsoImages,
        labelCameraState,
        canvas,
        selectedTargetId,
      ),
    [canvas, labelCameraState, registeredDsoImages, selectedTargetId],
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
    setConstellationCameraState(camera);
  }, []);
  const handleCameraPreview = useCallback((camera: PlanetariumCamera) => {
    setResidentCameraState((anchorCamera) =>
      shouldRefreshPlanetariumResidentCatalogue(anchorCamera, camera)
        ? camera
        : anchorCamera,
    );
    setConstellationCameraState(camera);
  }, []);
  const navigation = usePlanetariumNavigation({
    cameraState: initialCameraState,
    canvas,
    onCameraCommit: handleCameraCommit,
    onCameraPreview: handleCameraPreview,
    onTap: handleTap,
  });
  const lastAppliedFocusRequestId = useRef<number | null>(null);
  useEffect(() => {
    if (
      !focusRequest ||
      focusRequest.id === lastAppliedFocusRequestId.current
    ) {
      return;
    }
    lastAppliedFocusRequestId.current = focusRequest.id;
    navigation.focusDirection(focusRequest.direction);
  }, [focusRequest, navigation]);

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
            astronomicalDarknessIntervals={astronomicalDarknessIntervals}
            camera={navigation.camera}
            canvas={canvas}
            celestialEquatorDirections={celestialEquatorDirections}
            diurnalOrbit={diurnalOrbit}
            equipment={fieldOfViewEquipment}
            fieldOfViewRotationDegrees={fieldOfViewRotationDegrees}
            mask={maskPresentation?.mask ?? null}
            maskColor={maskPresentation?.color}
            maskMode={maskPresentation?.mode}
            maskOpacity={(maskPresentation?.opacityPercent ?? 0) / 100}
            panoramaOpacity={(maskPresentation?.opacityPercent ?? 0) / 100}
            panoramaImage={maskPresentation?.panorama}
            panoramaTiles={maskPresentation?.panorama?.tiles ?? []}
            registeredSky={visibleRegisteredSky}
            registeredStarBatches={registeredStarBatches}
            constellationLabels={constellationLabels}
            constellationOpacity={constellationOpacityPercent / 100}
            registeredDsoImages={visibleRegisteredDsoImages}
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
