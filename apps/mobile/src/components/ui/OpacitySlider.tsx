import { useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { colors, layout } from '../../theme/tokens';
import { AppText } from './AppText';

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

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
  const updateFromLocation = (locationXPixels: number) =>
    onChange(clampPercent(Math.round((locationXPixels / widthPixels) * 100)));
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
    // Width and callback changes must update gesture mapping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, widthPixels],
  );
  const handleLayout = (event: LayoutChangeEvent) =>
    setWidthPixels(Math.max(1, event.nativeEvent.layout.width));
  const boundedValue = clampPercent(value);
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
        style={styles.touchTrack}
        {...responder.panHandlers}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${boundedValue}%` }]} />
          <View style={[styles.thumb, { left: `${boundedValue}%` }]} />
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
