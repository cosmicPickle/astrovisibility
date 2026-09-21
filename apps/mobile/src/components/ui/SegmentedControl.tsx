import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout } from '../../theme/tokens';
import { AppText } from './AppText';

export interface SegmentedControlOption<Value extends string> {
  accessibilityLabel: string;
  label: string;
  value: Value;
}

export function SegmentedControl<Value extends string>({
  compact = false,
  disabled = false,
  onChange,
  options,
  value,
}: Readonly<{
  compact?: boolean;
  disabled?: boolean;
  onChange: (value: Value) => void;
  options: readonly SegmentedControlOption<Value>[];
  value: Value;
}>) {
  return (
    <View
      accessibilityRole="toolbar"
      style={[styles.control, disabled && styles.disabled]}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={
              disabled ? { selected, disabled: true } : { selected }
            }
            disabled={disabled || undefined}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              compact && styles.compactSegment,
              index === 0 && styles.firstSegment,
              index === options.length - 1 && styles.lastSegment,
              selected && styles.selectedSegment,
            ]}
          >
            <AppText
              style={[
                selected ? styles.selectedText : styles.text,
                compact && styles.compactText,
              ]}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row' },
  compactSegment: { paddingHorizontal: 5 },
  compactText: { fontSize: 12, textAlign: 'center' },
  disabled: { opacity: 0.46 },
  firstSegment: {
    borderBottomLeftRadius: layout.controlRadius,
    borderLeftWidth: 1,
    borderTopLeftRadius: layout.controlRadius,
  },
  lastSegment: {
    borderBottomRightRadius: layout.controlRadius,
    borderTopRightRadius: layout.controlRadius,
  },
  segment: {
    alignItems: 'center',
    borderColor: colors.outline,
    borderLeftWidth: 0,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 12,
  },
  selectedSegment: { backgroundColor: colors.primaryPressed },
  selectedText: { color: colors.text, fontWeight: '800' },
  text: { color: colors.mutedText, fontWeight: '700' },
});
