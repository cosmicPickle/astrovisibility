import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import {
  ATLAS_TARGET_COUNT_STEP,
  clampAtlasTargetCount,
  MAXIMUM_ATLAS_TARGET_COUNT,
  MINIMUM_ATLAS_TARGET_COUNT,
} from '../../targets/atlasDensity';
import { colors, layout } from '../../theme/tokens';
import { AppText } from './AppText';

export const TargetDensitySlider = ({
  onChange,
  value,
}: {
  onChange(value: number): void;
  value: number;
}) => {
  const [widthPixels, setWidthPixels] = useState(1);
  const [previewTargetCount, setPreviewTargetCount] = useState(value);
  const previewTargetCountRef = useRef(value);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    const nextValue = clampAtlasTargetCount(value);
    previewTargetCountRef.current = nextValue;
    setPreviewTargetCount(nextValue);
  }, [value]);

  const previewFromLocation = (locationXPixels: number) => {
    draggingRef.current = true;
    const ratio = Math.max(0, Math.min(1, locationXPixels / widthPixels));
    const nextValue = clampAtlasTargetCount(
      MINIMUM_ATLAS_TARGET_COUNT +
        ratio * (MAXIMUM_ATLAS_TARGET_COUNT - MINIMUM_ATLAS_TARGET_COUNT),
    );
    previewTargetCountRef.current = nextValue;
    setPreviewTargetCount(nextValue);
  };
  const commitPreview = (locationXPixels?: number) => {
    if (locationXPixels !== undefined) previewFromLocation(locationXPixels);
    draggingRef.current = false;
    const nextValue = previewTargetCountRef.current;
    if (nextValue !== clampAtlasTargetCount(value)) onChange(nextValue);
  };
  const boundedValue = clampAtlasTargetCount(previewTargetCount);
  const percent =
    ((boundedValue - MINIMUM_ATLAS_TARGET_COUNT) /
      (MAXIMUM_ATLAS_TARGET_COUNT - MINIMUM_ATLAS_TARGET_COUNT)) *
    100;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText tone="label">Minimum atlas targets</AppText>
        <AppText tone="muted">{boundedValue}</AppText>
      </View>
      <View
        accessibilityActions={[
          { name: 'decrement', label: 'Show fewer atlas targets' },
          { name: 'increment', label: 'Show more atlas targets' },
        ]}
        accessibilityLabel="Minimum atlas targets"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: MINIMUM_ATLAS_TARGET_COUNT,
          max: MAXIMUM_ATLAS_TARGET_COUNT,
          now: boundedValue,
          text: `${boundedValue} targets`,
        }}
        onAccessibilityAction={(event) => {
          const delta =
            event.nativeEvent.actionName === 'increment'
              ? ATLAS_TARGET_COUNT_STEP
              : event.nativeEvent.actionName === 'decrement'
                ? -ATLAS_TARGET_COUNT_STEP
                : 0;
          onChange(clampAtlasTargetCount(boundedValue + delta));
        }}
        onLayout={(event: LayoutChangeEvent) =>
          setWidthPixels(Math.max(1, event.nativeEvent.layout.width))
        }
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) =>
          previewFromLocation(event.nativeEvent.locationX)
        }
        onResponderMove={(event) =>
          previewFromLocation(event.nativeEvent.locationX)
        }
        onResponderRelease={(event) =>
          commitPreview(event.nativeEvent.locationX)
        }
        onResponderTerminate={() => commitPreview()}
        onStartShouldSetResponder={() => true}
        style={styles.touchTrack}
      >
        <View
          pointerEvents="none"
          style={styles.track}
          testID="target-density-slider-track"
        >
          <View style={[styles.fill, { width: `${percent}%` }]} />
          <View
            style={[styles.thumb, { left: `${percent}%` }]}
            testID="target-density-slider-thumb"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  field: { gap: 4 },
  fill: {
    backgroundColor: colors.primary,
    borderRadius: 2,
    height: 4,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  thumb: {
    backgroundColor: colors.text,
    borderColor: colors.primary,
    borderRadius: 9,
    borderWidth: 3,
    height: 18,
    marginLeft: -9,
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -9 }],
    width: 18,
  },
  touchTrack: {
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
  },
  track: {
    backgroundColor: colors.outline,
    borderRadius: 2,
    height: 4,
  },
});
