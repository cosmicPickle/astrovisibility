import { useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { AppText } from '../components/ui/AppText';
import { colors, layout } from '../theme/tokens';

export const MINIMUM_BRUSH_DIAMETER_PIXELS = 8;
export const MAXIMUM_BRUSH_DIAMETER_PIXELS = 72;

const clampBrushDiameter = (value: number) =>
  Math.max(
    MINIMUM_BRUSH_DIAMETER_PIXELS,
    Math.min(MAXIMUM_BRUSH_DIAMETER_PIXELS, Math.round(value)),
  );

export function BrushSizeControl({
  onChange,
  valuePixels,
}: {
  onChange(valuePixels: number): void;
  valuePixels: number;
}) {
  const [widthPixels, setWidthPixels] = useState(1);
  const boundedValue = clampBrushDiameter(valuePixels);
  const percent =
    ((boundedValue - MINIMUM_BRUSH_DIAMETER_PIXELS) /
      (MAXIMUM_BRUSH_DIAMETER_PIXELS - MINIMUM_BRUSH_DIAMETER_PIXELS)) *
    100;
  const updateFromLocation = (locationXPixels: number) =>
    onChange(
      clampBrushDiameter(
        MINIMUM_BRUSH_DIAMETER_PIXELS +
          (locationXPixels / widthPixels) *
            (MAXIMUM_BRUSH_DIAMETER_PIXELS - MINIMUM_BRUSH_DIAMETER_PIXELS),
      ),
    );
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) =>
          updateFromLocation(event.nativeEvent.locationX),
        onPanResponderMove: (event) =>
          updateFromLocation(event.nativeEvent.locationX),
      }),
    // Gesture mapping must track the measured width and latest callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, widthPixels],
  );
  const handleLayout = (event: LayoutChangeEvent) =>
    setWidthPixels(Math.max(1, event.nativeEvent.layout.width));
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText tone="label">Brush size</AppText>
        <AppText tone="muted">{boundedValue} px</AppText>
      </View>
      <View
        accessibilityActions={[
          { name: 'decrement', label: 'Decrease brush size' },
          { name: 'increment', label: 'Increase brush size' },
        ]}
        accessibilityLabel="Brush size"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: MINIMUM_BRUSH_DIAMETER_PIXELS,
          max: MAXIMUM_BRUSH_DIAMETER_PIXELS,
          now: boundedValue,
          text: `${boundedValue} pixels`,
        }}
        onAccessibilityAction={(event) => {
          const delta =
            event.nativeEvent.actionName === 'increment'
              ? 4
              : event.nativeEvent.actionName === 'decrement'
                ? -4
                : 0;
          onChange(clampBrushDiameter(boundedValue + delta));
        }}
        onLayout={handleLayout}
        style={styles.touchTrack}
        {...responder.panHandlers}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
          <View style={[styles.thumb, { left: `${percent}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4, minWidth: 140, width: '100%' },
  fill: {
    backgroundColor: colors.danger,
    borderRadius: 2,
    height: 4,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  thumb: {
    backgroundColor: colors.text,
    borderColor: colors.danger,
    borderRadius: 9,
    borderWidth: 3,
    height: 18,
    marginLeft: -9,
    marginTop: -11,
    position: 'absolute',
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
