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
  shouldRefreshPlanetariumResidentCatalogue,
  type HorizontalCatalogueTarget,
} from './planetariumCatalogue';
import {
  createInitialPlanetariumCamera,
  projectHorizontalDirection,
  vectorToHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';
import { PlanetariumScene } from './PlanetariumScene';
import type { MaskMode } from './MaskAppearanceControls';
import {
  selectRegisteredConstellationLabels,
  selectRegisteredDsoImages,
  selectRegisteredCelestialStarBatches,
  selectVisibleRegisteredConstellations,
  type RegisteredDsoImage,
} from './registeredSkyProjection';
import { useLatestValue } from './useLatestValue';
import { usePlanetariumNavigation } from './usePlanetariumNavigation';
import type { SharedValue } from 'react-native-reanimated';
import {
  projectJ2000ToObservedHorizontalVector,
  type CelestialTimeTransform,
} from '../astronomy/celestialTimeTransform';
import type {
  RegisteredCelestialDsoImage,
  RegisteredCelestialSky,
} from './celestialSkyGeometry';
import {
  selectCelestialResidentTargets,
  type CelestialCatalogueTarget,
} from './celestialCatalogue';

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
  constellationOpacityPercent: number;
  celestialTimeTransform: CelestialTimeTransform;
  sceneTimeMilliseconds: SharedValue<number>;
  registeredCelestialSky: RegisteredCelestialSky;
  registeredCelestialDsoImages: readonly RegisteredCelestialDsoImage[];
  celestialTargets: readonly CelestialCatalogueTarget[];
  controlTimeMilliseconds: number;
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
  constellationOpacityPercent,
  celestialTimeTransform,
  sceneTimeMilliseconds,
  registeredCelestialSky,
  registeredCelestialDsoImages,
  celestialTargets,
  controlTimeMilliseconds,
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
      selectCelestialResidentTargets({
        camera: residentCameraState,
        canvas,
        catalogue: celestialTargets,
        densityCandidateCount,
        floorTargetIds,
        selectedTargetId,
        timeTransform: celestialTimeTransform,
        timestampMilliseconds: controlTimeMilliseconds,
      }),
    [
      canvas,
      celestialTargets,
      celestialTimeTransform,
      controlTimeMilliseconds,
      densityCandidateCount,
      floorTargetIds,
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
  const registeredCelestialStarBatches = useMemo(
    () =>
      selectRegisteredCelestialStarBatches({
        camera: residentCameraState,
        canvas,
        stars: registeredCelestialSky.stars,
        timeTransform: celestialTimeTransform,
        timestampMilliseconds: controlTimeMilliseconds,
      }),
    [
      canvas,
      celestialTimeTransform,
      controlTimeMilliseconds,
      registeredCelestialSky.stars,
      residentCameraState,
    ],
  );
  const controlRegisteredConstellations = useMemo(
    () =>
      registeredCelestialSky.constellations.map((constellation) => ({
        id: constellation.id,
        label: vectorToHorizontalDirection(
          projectJ2000ToObservedHorizontalVector(
            constellation.labelJ2000UnitVector,
            celestialTimeTransform,
            controlTimeMilliseconds,
          ),
        ),
        lines: constellation.lineJ2000UnitVectors.map((line) =>
          line.map((vector) =>
            vectorToHorizontalDirection(
              projectJ2000ToObservedHorizontalVector(
                vector,
                celestialTimeTransform,
                controlTimeMilliseconds,
              ),
            ),
          ),
        ),
        name: constellation.name,
        rank: constellation.rank,
      })),
    [
      celestialTimeTransform,
      controlTimeMilliseconds,
      registeredCelestialSky.constellations,
    ],
  );
  const visibleRegisteredConstellations = useMemo(
    () =>
      selectVisibleRegisteredConstellations(
        controlRegisteredConstellations,
        constellationCameraState,
        canvas,
      ),
    [canvas, constellationCameraState, controlRegisteredConstellations],
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
  const celestialConstellationById = useMemo(
    () =>
      new Map(
        registeredCelestialSky.constellations.map((constellation) => [
          constellation.id,
          constellation,
        ]),
      ),
    [registeredCelestialSky.constellations],
  );
  const visibleCelestialConstellations = useMemo(
    () =>
      visibleRegisteredConstellations.flatMap((constellation) => {
        const celestialConstellation = celestialConstellationById.get(
          constellation.id,
        );
        return celestialConstellation ? [celestialConstellation] : [];
      }),
    [celestialConstellationById, visibleRegisteredConstellations],
  );
  const celestialConstellationLabels = useMemo(
    () =>
      constellationLabels.flatMap((constellation) => {
        const celestialConstellation = celestialConstellationById.get(
          constellation.id,
        );
        return celestialConstellation ? [celestialConstellation] : [];
      }),
    [celestialConstellationById, constellationLabels],
  );
  const visibleRegisteredDsoImages = useMemo(
    () =>
      selectRegisteredDsoImages(
        registeredCelestialDsoImages.map((image): RegisteredDsoImage => {
          const centerDirection = vectorToHorizontalDirection(
            projectJ2000ToObservedHorizontalVector(
              image.mesh.centerJ2000UnitVector,
              celestialTimeTransform,
              controlTimeMilliseconds,
            ),
          );
          return {
            mesh: {
              angularRadiusDegrees: image.mesh.angularRadiusDegrees,
              centerDirection,
              columnCount: 0,
              directions: [],
              directionVectors: [],
              indices: [],
              rowCount: 0,
              texturePointsPixels: [],
            },
            source: image.source,
            targetId: image.targetId,
          };
        }),
        labelCameraState,
        canvas,
        selectedTargetId,
      ),
    [
      canvas,
      celestialTimeTransform,
      controlTimeMilliseconds,
      labelCameraState,
      registeredCelestialDsoImages,
      selectedTargetId,
    ],
  );
  const celestialDsoImageById = useMemo(
    () =>
      new Map(
        registeredCelestialDsoImages.map((image) => [image.targetId, image]),
      ),
    [registeredCelestialDsoImages],
  );
  const visibleCelestialDsoImages = useMemo(
    () =>
      visibleRegisteredDsoImages.flatMap((image) => {
        const celestialImage = celestialDsoImageById.get(image.targetId);
        return celestialImage ? [celestialImage] : [];
      }),
    [celestialDsoImageById, visibleRegisteredDsoImages],
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
            registeredCelestialSky={{
              ...registeredCelestialSky,
              constellations: visibleCelestialConstellations,
            }}
            registeredCelestialStarBatches={registeredCelestialStarBatches}
            celestialConstellationLabels={celestialConstellationLabels}
            celestialTimeTransform={celestialTimeTransform}
            sceneTimeMilliseconds={sceneTimeMilliseconds}
            constellationOpacity={constellationOpacityPercent / 100}
            registeredCelestialDsoImages={visibleCelestialDsoImages}
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
