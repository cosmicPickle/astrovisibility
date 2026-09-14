import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { colors, layout } from '../theme/tokens';
import { BrushSizeControl } from './BrushSizeControl';

const BRUSH_STEPS = [8, 12, 16, 24, 32, 48, 64, 72] as const;

export function CompactBrushSizeControl({
  onChange,
  valuePixels,
}: {
  onChange(valuePixels: number): void;
  valuePixels: number;
}) {
  const [sliderVisible, setSliderVisible] = useState(false);
  const smaller = BRUSH_STEPS.findLast((size) => size < valuePixels);
  const larger = BRUSH_STEPS.find((size) => size > valuePixels);
  return (
    <>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel="Decrease brush size"
          accessibilityRole="button"
          accessibilityState={{ disabled: smaller === undefined }}
          disabled={smaller === undefined}
          onPress={() => smaller !== undefined && onChange(smaller)}
          style={[styles.step, smaller === undefined && styles.disabled]}
        >
          <AppText style={styles.symbol}>−</AppText>
        </Pressable>
        <Pressable
          accessibilityLabel={`Adjust brush size, ${valuePixels} pixels`}
          accessibilityRole="button"
          onPress={() => setSliderVisible(true)}
          style={styles.value}
        >
          <AppText tone="label">Brush size: {valuePixels} px</AppText>
        </Pressable>
        <Pressable
          accessibilityLabel="Increase brush size"
          accessibilityRole="button"
          accessibilityState={{ disabled: larger === undefined }}
          disabled={larger === undefined}
          onPress={() => larger !== undefined && onChange(larger)}
          style={[styles.step, larger === undefined && styles.disabled]}
        >
          <AppText style={styles.symbol}>+</AppText>
        </Pressable>
      </View>
      <ModalSheet
        closeAccessibilityLabel="Close brush size"
        onClose={() => setSliderVisible(false)}
        title="Brush size"
        visible={sliderVisible}
      >
        <BrushSizeControl onChange={onChange} valuePixels={valuePixels} />
      </ModalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.35 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  step: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: layout.controlRadius,
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
    minWidth: layout.minimumTouchTarget,
  },
  symbol: { fontSize: 24 },
  value: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 12,
  },
});
