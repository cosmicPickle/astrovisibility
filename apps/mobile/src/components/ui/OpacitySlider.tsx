import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { colors, layout } from '../../theme/tokens';
import { AppText } from './AppText';

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
const ZERO_SNAP_PIXELS = 12;

export const OpacitySlider = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange(value: number): void;
  value: number;
}) => {
  const [widthPixels, setWidthPixels] = useState(1);
  const [previewPercent, setPreviewPercent] = useState(value);
  const previewPercentRef = useRef(value);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (draggingRef.current) return;
    const nextValue = clampPercent(value);
    previewPercentRef.current = nextValue;
    setPreviewPercent(nextValue);
  }, [value]);
  const valueFromLocation = (locationXPixels: number) =>
    locationXPixels <= ZERO_SNAP_PIXELS
      ? 0
      : clampPercent(Math.round((locationXPixels / widthPixels) * 100));
  const previewFromLocation = (locationXPixels: number) => {
    draggingRef.current = true;
    const nextValue = valueFromLocation(locationXPixels);
    previewPercentRef.current = nextValue;
    setPreviewPercent(nextValue);
  };
  const commitPreview = (locationXPixels?: number) => {
    if (locationXPixels !== undefined) previewFromLocation(locationXPixels);
    draggingRef.current = false;
    const nextValue = previewPercentRef.current;
    if (nextValue !== clampPercent(value)) onChange(nextValue);
  };
  const handleLayout = (event: LayoutChangeEvent) =>
    setWidthPixels(Math.max(1, event.nativeEvent.layout.width));
  const boundedValue = clampPercent(previewPercent);
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText tone="label">{label}</AppText>
        <AppText tone="muted">{Math.round(boundedValue)}%</AppText>
      </View>
      <View
        accessibilityActions={[
          { name: 'decrement', label: 'Decrease opacity' },
          { name: 'increment', label: 'Increase opacity' },
        ]}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: boundedValue,
          text: `${Math.round(boundedValue)} percent`,
        }}
        onAccessibilityAction={(event) => {
          const delta =
            event.nativeEvent.actionName === 'increment'
              ? 5
              : event.nativeEvent.actionName === 'decrement'
                ? -5
                : 0;
          onChange(clampPercent(boundedValue + delta));
        }}
        onLayout={handleLayout}
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
          testID="opacity-slider-track"
        >
          <View style={[styles.fill, { width: `${boundedValue}%` }]} />
          <View
            style={[styles.thumb, { left: `${boundedValue}%` }]}
            testID="opacity-slider-thumb"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    gap: 4,
  },
  fill: {
    backgroundColor: colors.primary,
    borderRadius: 2,
    height: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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
