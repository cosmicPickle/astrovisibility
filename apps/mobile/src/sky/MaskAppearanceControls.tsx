import ColorPicker, {
  HueSlider,
  Panel1,
  Preview,
} from 'reanimated-color-picker';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../components/ui/AppText';
import { OpacitySlider } from '../components/ui/OpacitySlider';
import { colors, layout } from '../theme/tokens';

export type MaskMode = 'panorama' | 'color';

export function MaskAppearanceControls({
  color,
  mode,
  onColorChange,
  onModeChange,
  onOpacityChange,
  opacityPercent,
}: {
  color: string;
  mode: MaskMode;
  onColorChange(color: string): void;
  onModeChange(mode: MaskMode): void;
  onOpacityChange(opacityPercent: number): void;
  opacityPercent: number;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <AppText tone="label">Mask mode</AppText>
        <View accessibilityRole="radiogroup" style={styles.segmentedControl}>
          {(['panorama', 'color'] as const).map((option) => {
            const selected = mode === option;
            const label = option === 'panorama' ? 'Panorama' : 'Color';
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option}
                onPress={() => onModeChange(option)}
                style={({ pressed }) => [
                  styles.segment,
                  selected && styles.segmentSelected,
                  pressed && styles.segmentPressed,
                ]}
              >
                <AppText style={selected ? styles.segmentTextSelected : null}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {mode === 'color' ? (
        <View style={styles.colorField}>
          <AppText tone="label">Mask color</AppText>
          <ColorPicker
            boundedThumb
            onCompleteJS={({ hex }) => onColorChange(hex)}
            sliderThickness={28}
            thumbSize={24}
            value={color}
          >
            <Preview
              colorFormat="hex"
              hideInitialColor
              style={styles.preview}
              textStyle={styles.previewText}
            />
            <Panel1 style={styles.panel} />
            <HueSlider style={styles.hueSlider} />
          </ColorPicker>
        </View>
      ) : null}
      <OpacitySlider
        label="Mask opacity"
        onChange={onOpacityChange}
        value={opacityPercent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  colorField: {
    gap: 10,
  },
  container: {
    gap: layout.sectionGap,
  },
  field: {
    gap: 6,
  },
  hueSlider: {
    borderRadius: 10,
    marginTop: 12,
  },
  panel: {
    borderRadius: layout.cardRadius,
    height: 180,
  },
  preview: {
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    marginBottom: 12,
  },
  previewText: {
    color: colors.text,
  },
  segment: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
  },
  segmentPressed: {
    opacity: 0.8,
  },
  segmentedControl: {
    backgroundColor: colors.background,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segmentSelected: {
    backgroundColor: colors.primary,
  },
  segmentTextSelected: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
