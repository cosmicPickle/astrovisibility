import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Ellipse,
  G,
  Image as SvgImage,
  Line,
  Path,
  Polygon,
  Text as SvgText,
} from 'react-native-svg';

import type {
  SelectedTargetTrajectory,
  TrajectoryMarker,
} from '../astronomy/trajectory';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import { MaskOverlayLayer } from '../mask/MaskOverlayLayer';
import type { VisibilityMask } from '../mask/visibilityMask';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import { colors } from '../theme/tokens';
import {
  queryCatalogueViewport,
  buildHorizontalSpatialIndex,
  type HorizontalCatalogueTarget,
} from './catalogueViewport';
import {
  createTrajectoryInspectionViewport,
  createSkyViewport,
  projectDirectionToViewport,
  type SkyViewport,
} from './skyViewport';
import {
  buildClassifiedTrajectoryViewportSegments,
  projectFieldOfViewToViewport,
  projectTrajectoryCoordinateToViewport,
} from './skyOverlayGeometry';
import { projectPanoramaTilesToViewport } from './panoramaOverlayGeometry';
import { useSkyNavigation } from './useSkyNavigation';

export const TRAJECTORY_MARKER_HIT_RADIUS_PIXELS = 22;

export interface SkyCanvasProps {
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

const initialViewport = createSkyViewport({
  centerAltitudeDegrees: 45,
  centerAzimuthDegrees: 180,
  horizontalSpanDegrees: 360,
});

const cardinalDirections = [
  { azimuthDegrees: 0, label: 'N' },
  { azimuthDegrees: 90, label: 'E' },
  { azimuthDegrees: 180, label: 'S' },
  { azimuthDegrees: 270, label: 'W' },
] as const;

export const SkyCanvas = ({
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
  const [viewport, setViewport] = useState<SkyViewport>(initialViewport);
  const gestureScale = useSharedValue(1);
  const gestureFocalX = useSharedValue(0);
  const gestureFocalY = useSharedValue(0);
  const gestureTranslationX = useSharedValue(0);
  const gestureTranslationY = useSharedValue(0);
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
  const spatialIndex = useMemo(
    () => buildHorizontalSpatialIndex(targets),
    [targets],
  );
  const visibleTargets = useMemo(
    () =>
      queryCatalogueViewport(spatialIndex, viewport, canvas, {
        overscanRatio: 0.5,
      }),
    [canvas, spatialIndex, viewport],
  );
  const trajectorySegments = useMemo(
    () =>
      trajectory
        ? buildClassifiedTrajectoryViewportSegments(
            trajectory.samples,
            viewport,
            canvas,
          )
        : [],
    [canvas, trajectory, viewport],
  );
  const trajectoryTransitions = useMemo(
    () =>
      trajectory?.transitions.map((transition) => ({
        point: projectTrajectoryCoordinateToViewport(
          transition,
          trajectory.samples,
          viewport,
          canvas,
        ),
        transition,
      })) ?? [],
    [canvas, trajectory, viewport],
  );
  const trajectoryMarkers = useMemo(
    () =>
      trajectory?.markers.map((marker) => ({
        marker,
        point:
          marker.assessment === 'belowHorizon'
            ? null
            : projectTrajectoryCoordinateToViewport(
                marker,
                trajectory.samples,
                viewport,
                canvas,
              ),
      })) ?? [],
    [canvas, trajectory, viewport],
  );
  const fieldOfView = useMemo(
    () =>
      selectedDirection && fieldOfViewEquipment
        ? projectFieldOfViewToViewport(
            selectedDirection,
            fieldOfViewEquipment,
            viewport,
            canvas,
          )
        : null,
    [canvas, fieldOfViewEquipment, selectedDirection, viewport],
  );
  const panoramaTiles = useMemo(
    () =>
      panoramaOverlay?.visible
        ? projectPanoramaTilesToViewport(
            panoramaOverlay.tiles,
            viewport,
            canvas,
          )
        : [],
    [canvas, panoramaOverlay, viewport],
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
    const inspectionViewport = trajectory
      ? createTrajectoryInspectionViewport(trajectory.samples, canvas)
      : null;
    const nextViewport = inspectionViewport
      ? inspectionViewport
      : selectedDirection
        ? createSkyViewport({
            centerAltitudeDegrees: selectedDirection.altitudeDegrees,
            centerAzimuthDegrees: selectedDirection.azimuthDegrees,
            horizontalSpanDegrees: 60,
          })
        : null;
    if (!nextViewport) return;
    if (trajectory) fit.trajectoryFitted = true;
    else fit.directionFitted = true;
    const timeoutId = setTimeout(() => setViewport(nextViewport), 0);
    return () => clearTimeout(timeoutId);
  }, [canvas, selectedDirection, selectedTargetId, trajectory]);

  const markManualNavigation = useCallback(() => {
    selectionFitRef.current.manuallyNavigated = true;
  }, []);
  const navigation = useSkyNavigation({
    canvas,
    onManualNavigation: markManualNavigation,
    setViewport,
    viewport,
  });
  useLayoutEffect(() => {
    gestureScale.value = 1;
    gestureTranslationX.value = 0;
    gestureTranslationY.value = 0;
  }, [gestureScale, gestureTranslationX, gestureTranslationY, viewport]);
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .withTestId('sky-pan')
      .onStart(() => {
        gestureTranslationX.set(0);
        gestureTranslationY.set(0);
        runOnJS(navigation.beginPan)();
      })
      .onUpdate((event) => {
        gestureTranslationX.set(event.translationX);
        gestureTranslationY.set(event.translationY);
      })
      .onEnd((event) => {
        gestureTranslationX.set(event.translationX);
        gestureTranslationY.set(event.translationY);
        runOnJS(navigation.updatePan)(event.translationX, event.translationY);
        runOnJS(navigation.finishPan)();
      })
      .onFinalize(() => {
        runOnJS(navigation.updatePan)(
          gestureTranslationX.get(),
          gestureTranslationY.get(),
        );
        runOnJS(navigation.finishPan)();
      });
    const pinch = Gesture.Pinch()
      .withTestId('sky-pinch')
      .onStart((event) => {
        gestureScale.set(1);
        gestureFocalX.set(event.focalX);
        gestureFocalY.set(event.focalY);
        runOnJS(navigation.beginPinch)(event.focalX, event.focalY);
      })
      .onUpdate((event) => {
        gestureScale.set(event.scale);
        gestureFocalX.set(event.focalX);
        gestureFocalY.set(event.focalY);
      })
      .onEnd((event) => {
        gestureScale.set(event.scale);
        gestureFocalX.set(event.focalX);
        gestureFocalY.set(event.focalY);
        runOnJS(navigation.updatePinch)(
          event.scale,
          event.focalX,
          event.focalY,
        );
        runOnJS(navigation.finishPinch)();
      })
      .onFinalize(() => {
        runOnJS(navigation.updatePinch)(
          gestureScale.get(),
          gestureFocalX.get(),
          gestureFocalY.get(),
        );
        runOnJS(navigation.finishPinch)();
      });
    return Gesture.Simultaneous(pan, pinch);
  }, [
    gestureFocalX,
    gestureFocalY,
    gestureScale,
    gestureTranslationX,
    gestureTranslationY,
    navigation,
  ]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          gestureTranslationX.value +
          (1 - gestureScale.value) *
            (gestureFocalX.value - canvas.widthPixels / 2),
      },
      {
        translateY:
          gestureTranslationY.value +
          (1 - gestureScale.value) *
            (gestureFocalY.value - canvas.heightPixels / 2),
      },
      { scale: gestureScale.value },
    ],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvas({ widthPixels: width, heightPixels: height });
    }
  };

  return (
    <View onLayout={handleLayout} style={styles.container}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible={false}
          renderToHardwareTextureAndroid
          style={[
            styles.bufferedCanvas,
            {
              height: canvas.heightPixels * 2,
              left: -canvas.widthPixels / 2,
              top: -canvas.heightPixels / 2,
              width: canvas.widthPixels * 2,
            },
            animatedStyle,
          ]}
        >
          <Svg
            accessibilityLabel={`${visibleTargets.filter(({ labelVisible }) => labelVisible).length} deep-sky targets in the current sky viewport`}
            height="100%"
            style={styles.svgOverflow}
            width="100%"
          >
            <G
              transform={`translate(${canvas.widthPixels / 2} ${canvas.heightPixels / 2})`}
            >
              {[0, 30, 60, 90].map((altitudeDegrees) => {
                const start = projectDirectionToViewport(
                  {
                    altitudeDegrees,
                    azimuthDegrees:
                      viewport.centerAzimuthDegrees -
                      viewport.horizontalSpanDegrees / 2,
                  },
                  viewport,
                  canvas,
                  { overscanRatio: 0.5 },
                );
                if (!start) return null;
                return (
                  <G key={`altitude-${altitudeDegrees}`}>
                    <Line
                      stroke={colors.outline}
                      strokeDasharray="3 8"
                      strokeWidth={1}
                      x1={-canvas.widthPixels / 2}
                      x2={canvas.widthPixels * 1.5}
                      y1={start.yPixels}
                      y2={start.yPixels}
                    />
                    <SvgText
                      fill={colors.mutedText}
                      fontSize={10}
                      x={8}
                      y={Math.max(13, start.yPixels - 5)}
                    >
                      {altitudeDegrees}°
                    </SvgText>
                  </G>
                );
              })}
              {cardinalDirections.map((direction) => {
                const point = projectDirectionToViewport(
                  {
                    altitudeDegrees: Math.min(
                      86,
                      viewport.centerAltitudeDegrees,
                    ),
                    azimuthDegrees: direction.azimuthDegrees,
                  },
                  viewport,
                  canvas,
                  { overscanRatio: 0.5 },
                );
                return point ? (
                  <SvgText
                    fill={colors.mutedText}
                    fontSize={12}
                    fontWeight="700"
                    key={direction.label}
                    textAnchor="middle"
                    x={point.xPixels}
                    y={18}
                  >
                    {direction.label}
                  </SvgText>
                ) : null;
              })}
              {panoramaTiles.map((tile) => (
                <SvgImage
                  accessibilityLabel="Aligned panorama tile"
                  height={tile.heightPixels}
                  href={{ uri: tile.uri }}
                  key={tile.key}
                  opacity={(panoramaOverlay?.opacityPercent ?? 0) / 100}
                  preserveAspectRatio="xMidYMid slice"
                  transform={`rotate(${tile.rotationDegrees} ${tile.centerXPixels} ${tile.centerYPixels})`}
                  width={tile.widthPixels}
                  x={tile.centerXPixels - tile.widthPixels / 2}
                  y={tile.centerYPixels - tile.heightPixels / 2}
                />
              ))}
              {maskOverlay?.visible ? (
                <MaskOverlayLayer
                  canvas={canvas}
                  mask={maskOverlay.mask}
                  opacityPercent={maskOverlay.opacityPercent}
                  viewport={viewport}
                />
              ) : null}
              {trajectorySegments.map((segment, index) =>
                segment.points.length < 2 ? null : (
                  <Path
                    accessibilityLabel={
                      segment.assessment === 'visible'
                        ? 'Visible astronomical trajectory segment'
                        : segment.assessment === 'blocked'
                          ? 'Blocked astronomical trajectory segment'
                          : 'Astronomical trajectory; local obstructions not assessed'
                    }
                    d={segment.points
                      .map(
                        (point, pointIndex) =>
                          `${pointIndex === 0 ? 'M' : 'L'} ${point.xPixels.toFixed(2)} ${point.yPixels.toFixed(2)}`,
                      )
                      .join(' ')}
                    fill="none"
                    key={`trajectory-${segment.assessment}-${index}`}
                    opacity={segment.assessment === 'blocked' ? 0.72 : 1}
                    stroke={
                      segment.assessment === 'visible'
                        ? colors.primary
                        : segment.assessment === 'blocked'
                          ? colors.blocked
                          : colors.spaceViolet
                    }
                    strokeDasharray={
                      segment.assessment === 'visible' ? undefined : '7 5'
                    }
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={segment.assessment === 'visible' ? 3 : 2.5}
                  />
                ),
              )}
              {trajectoryTransitions.map(({ point, transition }, index) => {
                if (!point) return null;
                const nearLeft = point.xPixels < 110;
                const nearRight = point.xPixels > canvas.widthPixels - 110;
                const labelY = Math.max(
                  13,
                  Math.min(
                    canvas.heightPixels - 7,
                    point.yPixels + (index % 2 === 0 ? -11 : 17),
                  ),
                );
                return (
                  <G
                    accessibilityLabel={transition.displayLabel}
                    key={`${transition.kind}-${transition.timestampUtc}`}
                  >
                    <Circle
                      cx={point.xPixels}
                      cy={point.yPixels}
                      fill={colors.backdrop}
                      r={5}
                      stroke={
                        transition.kind === 'becameVisible'
                          ? colors.primary
                          : colors.blocked
                      }
                      strokeWidth={2.5}
                    />
                    <SvgText
                      fill={colors.text}
                      fontSize={9}
                      fontWeight="700"
                      textAnchor={
                        nearLeft ? 'start' : nearRight ? 'end' : 'middle'
                      }
                      x={Math.max(
                        6,
                        Math.min(canvas.widthPixels - 6, point.xPixels),
                      )}
                      y={labelY}
                    >
                      {transition.displayLabel}
                    </SvgText>
                  </G>
                );
              })}
              {trajectoryMarkers.map(({ marker, point }, index) => {
                if (!point) return null;
                return (
                  <G
                    accessibilityLabel={`${marker.localTimeLabel} trajectory marker, ${marker.refractedAltitudeDegrees.toFixed(1)} degrees altitude`}
                    accessibilityRole="button"
                    key={marker.timestampUtc}
                    onPress={() => onInspectTrajectoryMarker(marker)}
                  >
                    <Circle
                      cx={point.xPixels}
                      cy={point.yPixels}
                      fill="transparent"
                      r={TRAJECTORY_MARKER_HIT_RADIUS_PIXELS}
                    />
                    <Circle
                      cx={point.xPixels}
                      cy={point.yPixels}
                      fill={colors.backdrop}
                      r={4}
                      stroke={
                        marker.assessment === 'visible'
                          ? colors.primary
                          : marker.assessment === 'blocked'
                            ? colors.blocked
                            : colors.spaceViolet
                      }
                      strokeWidth={2}
                    />
                    {index % 2 === 0 ? (
                      <SvgText
                        fill={colors.text}
                        fontSize={9}
                        fontWeight="700"
                        textAnchor="middle"
                        x={point.xPixels}
                        y={point.yPixels - 8}
                      >
                        {marker.localTimeLabel}
                      </SvgText>
                    ) : null}
                  </G>
                );
              })}
              {fieldOfView ? (
                <Polygon
                  accessibilityLabel={`${fieldOfViewEquipment?.name ?? 'Selected equipment'} field of view, ${fieldOfView.horizontalFovDegrees.toFixed(1)} by ${fieldOfView.verticalFovDegrees.toFixed(1)} degrees; target-centre visibility only`}
                  fill={colors.primary}
                  fillOpacity={0.06}
                  points={fieldOfView.points
                    .map((point) => `${point.xPixels},${point.yPixels}`)
                    .join(' ')}
                  stroke={colors.primary}
                  strokeWidth={2}
                />
              ) : null}
              {visibleTargets.map((item) => {
                const selected = item.target.id === selectedTargetId;
                return (
                  <G
                    accessible={item.labelVisible}
                    accessibilityLabel={`Select ${item.target.preferredName}`}
                    accessibilityRole="button"
                    key={item.target.id}
                    onPress={() => onSelectTarget(item)}
                  >
                    <Ellipse
                      cx={item.xPixels}
                      cy={item.yPixels}
                      fill={selected ? colors.spaceViolet : colors.primary}
                      fillOpacity={selected ? 0.22 : 0.08}
                      rx={item.outlineWidthPixels / 2}
                      ry={item.outlineHeightPixels / 2}
                      stroke={selected ? colors.spaceViolet : colors.primary}
                      strokeWidth={selected ? 2 : 1.2}
                      transform={`rotate(${item.outlineRotationDegrees} ${item.xPixels} ${item.yPixels})`}
                    />
                    <Ellipse
                      cx={item.xPixels}
                      cy={item.yPixels}
                      fill="transparent"
                      rx={item.hitRadiusPixels}
                      ry={item.hitRadiusPixels}
                    />
                    {item.labelVisible ? (
                      <SvgText
                        fill={selected ? colors.spaceViolet : colors.text}
                        fontSize={11}
                        fontWeight="700"
                        textAnchor="middle"
                        x={item.xPixels}
                        y={item.yPixels + item.hitRadiusPixels + 10}
                      >
                        {item.label}
                      </SvgText>
                    ) : null}
                    {item.labelVisible && item.secondaryLabel ? (
                      <SvgText
                        fill={colors.mutedText}
                        fontSize={9}
                        textAnchor="middle"
                        x={item.xPixels}
                        y={item.yPixels + item.hitRadiusPixels + 21}
                      >
                        {item.secondaryLabel}
                      </SvgText>
                    ) : null}
                  </G>
                );
              })}
            </G>
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  bufferedCanvas: {
    position: 'absolute',
  },
  container: {
    backgroundColor: colors.backdrop,
    flex: 1,
    overflow: 'hidden',
  },
  svgOverflow: {
    overflow: 'visible',
  },
});
