import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { colors, layout } from '../../theme/tokens';
import { AppText } from './AppText';

const MINIMUM_ANGLE_DEGREES = 0;
const MAXIMUM_ANGLE_DEGREES = 180;
const clampAngle = (value: number) =>
  Math.max(MINIMUM_ANGLE_DEGREES, Math.min(MAXIMUM_ANGLE_DEGREES, value));

export const AngleSlider = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange(value: number): void;
  value: number;
}) => {
  const [widthPixels, setWidthPixels] = useState(1);
  const [previewDegrees, setPreviewDegrees] = useState(value);
  const previewDegreesRef = useRef(value);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (draggingRef.current) return;
    const nextValue = clampAngle(value);
    previewDegreesRef.current = nextValue;
    setPreviewDegrees(nextValue);
  }, [value]);
  const previewFromLocation = (locationXPixels: number) => {
    draggingRef.current = true;
    const nextValue = clampAngle(
      Math.round((locationXPixels / widthPixels) * MAXIMUM_ANGLE_DEGREES),
    );
    previewDegreesRef.current = nextValue;
    setPreviewDegrees(nextValue);
  };
  const commitPreview = (locationXPixels?: number) => {
    if (locationXPixels !== undefined) previewFromLocation(locationXPixels);
    draggingRef.current = false;
    const nextValue = previewDegreesRef.current;
    if (nextValue !== clampAngle(value)) onChange(nextValue);
  };
  const boundedValue = clampAngle(previewDegrees);
  const percent = (boundedValue / MAXIMUM_ANGLE_DEGREES) * 100;
  const handleLayout = (event: LayoutChangeEvent) =>
    setWidthPixels(Math.max(1, event.nativeEvent.layout.width));
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText tone="label">{label}</AppText>
        <AppText tone="muted">{boundedValue}°</AppText>
      </View>
      <View
        accessibilityActions={[
          { name: 'decrement', label: 'Rotate counter-clockwise' },
          { name: 'increment', label: 'Rotate clockwise' },
        ]}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: MINIMUM_ANGLE_DEGREES,
          max: MAXIMUM_ANGLE_DEGREES,
          now: boundedValue,
          text: `${boundedValue} degrees`,
        }}
        onAccessibilityAction={(event) => {
          const delta =
            event.nativeEvent.actionName === 'increment'
              ? 5
              : event.nativeEvent.actionName === 'decrement'
                ? -5
                : 0;
          onChange(clampAngle(boundedValue + delta));
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
          testID="angle-slider-track"
        >
          <View style={[styles.fill, { width: `${percent}%` }]} />
          <View
            style={[styles.thumb, { left: `${percent}%` }]}
            testID="angle-slider-thumb"
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
