import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, type AppIconName } from '../components/ui/AppIcon';
import { colors, layout } from '../theme/tokens';
import type { MaskPaintMode } from './maskBrushSelection';
import type { MaskEditorTool } from './MaskEditorScreen';

export function MaskToolControls({
  activeTool,
  mode,
  onToolChange,
  onModeChange,
  disabled,
}: {
  activeTool: MaskEditorTool;
  mode: MaskPaintMode;
  onToolChange(tool: MaskEditorTool): void;
  onModeChange(mode: MaskPaintMode): void;
  disabled: boolean;
}) {
  const groups = [
    [
      {
        label: 'Draw',
        icon: 'brush',
        selected: activeTool === 'blockedStroke',
        press: () => onToolChange('blockedStroke'),
      },
      {
        label: 'Erase',
        icon: 'eraser',
        selected: activeTool === 'visibleStroke',
        press: () => onToolChange('visibleStroke'),
      },
    ],
    [
      {
        label: 'Magic painting',
        icon: 'wand',
        selected: mode === 'magic',
        press: () => onModeChange('magic'),
      },
      {
        label: 'Manual painting',
        icon: 'hand',
        selected: mode === 'manual',
        press: () => onModeChange('manual'),
      },
    ],
  ];
  return (
    <View style={styles.row}>
      {groups.map((options, index) => (
        <View accessibilityRole="radiogroup" key={index} style={styles.group}>
          {options.map((option) => (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: option.selected, disabled }}
              disabled={disabled}
              key={option.label}
              onPress={option.press}
              style={[styles.button, option.selected && styles.selected]}
            >
              <AppIcon
                name={option.icon as AppIconName}
                color={option.selected ? colors.onPrimary : colors.text}
              />
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  group: {
    flexDirection: 'row',
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    overflow: 'hidden',
  },
  button: {
    minHeight: layout.minimumTouchTarget,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary },
});
