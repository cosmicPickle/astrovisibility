import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Polygon, Text } from 'react-native-svg';

import { colors, layout } from '../../theme/tokens';
import { AppText } from '../ui/AppText';
import { ActionButton } from '../ui/ActionButton';
import { projectHorizontalToCanvas } from '../../sky/projection';
import {
  createSyntheticSkyData,
  selectSyntheticViewportTargets,
} from '../../sky/syntheticSkyData';

const WORLD_WIDTH_PIXELS = 720;
const WORLD_HEIGHT_PIXELS = 360;
const SYNTHETIC_CATALOGUE_SIZE = 12_000;
const VIEWPORT_TARGET_LIMIT = 350;

type FrameResult = {
  frameRateP95: number;
  maximumStallMilliseconds: number;
};

const useFrameMeasurement = () => {
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [result, setResult] = useState<FrameResult | null>(null);
  const frameTimes = useRef<number[]>([]);
  const previousTimestamp = useRef<number | null>(null);
  const frameRequest = useRef<number | null>(null);

  const finish = useCallback(() => {
    if (frameRequest.current !== null) {
      cancelAnimationFrame(frameRequest.current);
    }
    const sorted = [...frameTimes.current].sort((left, right) => left - right);
    const p95Index = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * 0.95),
    );
    const p95Milliseconds = sorted[Math.max(0, p95Index)] ?? 0;
    setResult({
      frameRateP95:
        p95Milliseconds > 0 ? Math.round(1000 / p95Milliseconds) : 0,
      maximumStallMilliseconds: Math.round(sorted.at(-1) ?? 0),
    });
    setIsMeasuring(false);
  }, []);

  const start = useCallback(() => {
    if (isMeasuring) return;
    frameTimes.current = [];
    previousTimestamp.current = null;
    setResult(null);
    setIsMeasuring(true);
    const startedAt = Date.now();
    const sample = (timestamp: number) => {
      if (previousTimestamp.current !== null) {
        frameTimes.current.push(timestamp - previousTimestamp.current);
      }
      previousTimestamp.current = timestamp;
      if (Date.now() - startedAt >= 5000) {
        finish();
        return;
      }
      frameRequest.current = requestAnimationFrame(sample);
    };
    frameRequest.current = requestAnimationFrame(sample);
  }, [finish, isMeasuring]);

  return { isMeasuring, result, start };
};

const toPath = (points: { xPixels: number; yPixels: number }[]) =>
  points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.xPixels} ${point.yPixels}`,
    )
    .join(' ');

export const SyntheticSkyCanvas = () => {
  const translationX = useSharedValue(-WORLD_WIDTH_PIXELS);
  const translationY = useSharedValue(0);
  const gestureStartX = useSharedValue(-WORLD_WIDTH_PIXELS);
  const gestureStartY = useSharedValue(0);
  const scale = useSharedValue(1);
  const gestureStartScale = useSharedValue(1);
  const { isMeasuring, result, start } = useFrameMeasurement();

  const sky = useMemo(
    () => createSyntheticSkyData(SYNTHETIC_CATALOGUE_SIZE),
    [],
  );
  const visibleTargets = useMemo(
    () =>
      selectSyntheticViewportTargets(sky.targets, {
        minimumAzimuthDegrees: 300,
        maximumAzimuthDegrees: 420,
        minimumAltitudeDegrees: 0,
        maximumAltitudeDegrees: 90,
        limit: VIEWPORT_TARGET_LIMIT,
      }),
    [sky.targets],
  );
  const projectedTrajectory = useMemo(
    () =>
      sky.trajectory.map((point) =>
        projectHorizontalToCanvas(point, {
          widthPixels: WORLD_WIDTH_PIXELS,
          heightPixels: WORLD_HEIGHT_PIXELS,
        }),
      ),
    [sky.trajectory],
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      gestureStartX.value = translationX.value;
      gestureStartY.value = translationY.value;
    })
    .onUpdate((event) => {
      translationX.value = gestureStartX.value + event.translationX;
      translationY.value = Math.max(
        -WORLD_HEIGHT_PIXELS * 0.6,
        Math.min(80, gestureStartY.value + event.translationY),
      );
    })
    .onFinalize(() => {
      const relative = translationX.value + WORLD_WIDTH_PIXELS;
      const wrapped =
        ((relative % WORLD_WIDTH_PIXELS) + WORLD_WIDTH_PIXELS) %
        WORLD_WIDTH_PIXELS;
      translationX.value = wrapped - WORLD_WIDTH_PIXELS * 2;
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      gestureStartScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(
        0.8,
        Math.min(3.5, gestureStartScale.value * event.scale),
      );
    });
  const gesture = Gesture.Simultaneous(pan, pinch);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.canvasClip}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.world, animatedStyle]}>
            <Svg
              accessibilityLabel="Synthetic equirectangular sky technical proof"
              height={WORLD_HEIGHT_PIXELS}
              width={WORLD_WIDTH_PIXELS * 3}
            >
              {[0, 1, 2].map((copyIndex) => {
                const offsetX = copyIndex * WORLD_WIDTH_PIXELS;
                return (
                  <G key={copyIndex} x={offsetX}>
                    <Line
                      stroke={colors.outline}
                      strokeWidth={1}
                      x1={0}
                      x2={WORLD_WIDTH_PIXELS}
                      y1={WORLD_HEIGHT_PIXELS}
                      y2={WORLD_HEIGHT_PIXELS}
                    />
                    {[0, 30, 60, 90].map((altitudeDegrees) => {
                      const y =
                        ((90 - altitudeDegrees) / 90) * WORLD_HEIGHT_PIXELS;
                      return (
                        <G key={altitudeDegrees}>
                          <Line
                            stroke={colors.outline}
                            strokeDasharray="4 8"
                            strokeWidth={1}
                            x1={0}
                            x2={WORLD_WIDTH_PIXELS}
                            y1={y}
                            y2={y}
                          />
                          <Text
                            fill={colors.mutedText}
                            fontSize={10}
                            x={6}
                            y={Math.max(12, y - 4)}
                          >
                            {altitudeDegrees}°
                          </Text>
                        </G>
                      );
                    })}
                    {visibleTargets.map((target) => {
                      const point = projectHorizontalToCanvas(target, {
                        widthPixels: WORLD_WIDTH_PIXELS,
                        heightPixels: WORLD_HEIGHT_PIXELS,
                      });
                      return (
                        <Circle
                          cx={point.xPixels}
                          cy={point.yPixels}
                          fill={
                            target.prominence < 2
                              ? colors.text
                              : colors.mutedText
                          }
                          key={target.id}
                          opacity={0.82}
                          r={Math.max(1.25, target.radiusDegrees * 2)}
                        />
                      );
                    })}
                    <Polygon
                      fill={colors.primary}
                      fillOpacity={0.18}
                      points="700,250 740,250 740,150 700,150"
                      stroke={colors.primary}
                      strokeWidth={1.5}
                    />
                    <Line
                      stroke={colors.blocked}
                      strokeDasharray="5 4"
                      strokeLinecap="round"
                      strokeWidth={3}
                      x1={716}
                      x2={724}
                      y1={204}
                      y2={196}
                    />
                    <Path
                      d={toPath(projectedTrajectory)}
                      fill="none"
                      stroke={colors.spaceViolet}
                      strokeWidth={3}
                    />
                    {[
                      ['N', 35],
                      ['E', 180],
                      ['S', 360],
                      ['W', 540],
                    ].map(([label, x]) => (
                      <Text
                        fill={colors.text}
                        fontSize={13}
                        fontWeight="700"
                        key={label}
                        textAnchor="middle"
                        x={Number(x)}
                        y={50}
                      >
                        {label}
                      </Text>
                    ))}
                  </G>
                );
              })}
            </Svg>
          </Animated.View>
        </GestureDetector>
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metricCopy}>
          <AppText tone="label">Synthetic load</AppText>
          <AppText tone="muted">
            {SYNTHETIC_CATALOGUE_SIZE.toLocaleString()} indexed ·{' '}
            {visibleTargets.length} mounted per world
          </AppText>
          {result ? (
            <AppText tone="muted">
              p95 {result.frameRateP95} fps · max stall{' '}
              {result.maximumStallMilliseconds} ms
            </AppText>
          ) : null}
        </View>
        <ActionButton
          disabled={isMeasuring}
          label={isMeasuring ? 'Pan now…' : 'Measure 5 s'}
          onPress={start}
          variant="secondary"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  canvasClip: {
    backgroundColor: colors.backdrop,
    height: 320,
    overflow: 'hidden',
  },
  metricCopy: {
    flex: 1,
    gap: 2,
  },
  metricsRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  world: {
    height: WORLD_HEIGHT_PIXELS,
    width: WORLD_WIDTH_PIXELS * 3,
  },
  wrapper: {
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
