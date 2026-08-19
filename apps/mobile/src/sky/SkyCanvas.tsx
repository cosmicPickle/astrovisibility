import { useCallback, useEffect, useMemo, useState } from 'react';
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
  applySkyPan,
  applySkyZoom,
  createTrajectoryInspectionViewport,
  createSkyViewport,
  projectDirectionToViewport,
  type SkyViewport,
} from './skyViewport';
import {
  buildClassifiedTrajectoryViewportSegments,
  projectFieldOfViewToViewport,
} from './skyOverlayGeometry';
import { projectPanoramaTilesToViewport } from './panoramaOverlayGeometry';

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
  const spatialIndex = useMemo(
    () => buildHorizontalSpatialIndex(targets),
    [targets],
  );
  const visibleTargets = useMemo(
    () => queryCatalogueViewport(spatialIndex, viewport, canvas),
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
    if (!selectedTargetId) return;
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
    const timeoutId = setTimeout(() => setViewport(nextViewport), 0);
    return () => clearTimeout(timeoutId);
  }, [canvas, selectedDirection, selectedTargetId, trajectory]);

  const commitPan = useCallback(
    (translationXPixels: number, translationYPixels: number) => {
      setViewport((current) =>
        applySkyPan(current, canvas, {
          translationXPixels,
          translationYPixels,
        }),
      );
    },
    [canvas],
  );
  const commitZoom = useCallback(
    (scale: number, focalXPixels: number, focalYPixels: number) => {
      setViewport((current) =>
        applySkyZoom(current, canvas, {
          focalXPixels,
          focalYPixels,
          scale,
        }),
      );
    },
    [canvas],
  );
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      gestureTranslationX.value = event.translationX;
      gestureTranslationY.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(commitPan)(event.translationX, event.translationY);
    })
    .onFinalize(() => {
      gestureTranslationX.value = 0;
      gestureTranslationY.value = 0;
    });
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      gestureScale.value = event.scale;
      gestureFocalX.value = event.focalX;
      gestureFocalY.value = event.focalY;
    })
    .onEnd((event) => {
      runOnJS(commitZoom)(event.scale, event.focalX, event.focalY);
    })
    .onFinalize(() => {
      gestureScale.value = 1;
    });
  const gesture = Gesture.Simultaneous(pan, pinch);
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
          style={[styles.canvas, animatedStyle]}
        >
          <Svg
            accessibilityLabel={`${visibleTargets.length} deep-sky targets in the current sky viewport`}
            height="100%"
            width="100%"
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
              );
              if (!start) return null;
              return (
                <G key={`altitude-${altitudeDegrees}`}>
                  <Line
                    stroke={colors.outline}
                    strokeDasharray="3 8"
                    strokeWidth={1}
                    x1={0}
                    x2={canvas.widthPixels}
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
                  altitudeDegrees: Math.min(86, viewport.centerAltitudeDegrees),
                  azimuthDegrees: direction.azimuthDegrees,
                },
                viewport,
                canvas,
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
                  strokeWidth={segment.assessment === 'visible' ? 3 : 2.5}
                />
              ),
            )}
            {trajectory?.transitions.map((transition, index) => {
              const point = projectDirectionToViewport(
                {
                  altitudeDegrees: transition.refractedAltitudeDegrees,
                  azimuthDegrees: transition.azimuthDegreesClockwiseFromNorth,
                },
                viewport,
                canvas,
              );
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
            {trajectory?.markers.map((marker, index) => {
              if (marker.assessment === 'belowHorizon') return null;
              const point = projectDirectionToViewport(
                {
                  altitudeDegrees: marker.refractedAltitudeDegrees,
                  azimuthDegrees: marker.azimuthDegreesClockwiseFromNorth,
                },
                viewport,
                canvas,
              );
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
                  {item.secondaryLabel ? (
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
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.backdrop,
    flex: 1,
    overflow: 'hidden',
  },
});
