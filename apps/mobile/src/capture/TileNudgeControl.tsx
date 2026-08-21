import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../components/ui/AppText';
import { colors } from '../theme/tokens';

export function TileNudgeControl({
  disabled,
  onDown,
  onLeft,
  onRight,
  onUp,
}: {
  disabled?: boolean;
  onDown(): void;
  onLeft(): void;
  onRight(): void;
  onUp(): void;
}) {
  return (
    <View
      accessibilityLabel="Tile alignment directional control"
      style={styles.control}
    >
      <Pressable
        accessibilityLabel="Move selected tile up"
        accessibilityRole="button"
        disabled={disabled}
        onPress={onUp}
        style={({ pressed }) => [
          styles.button,
          styles.up,
          pressed && styles.pressed,
        ]}
      >
        <AppText style={styles.arrow}>↑</AppText>
      </Pressable>
      <Pressable
        accessibilityLabel="Move selected tile right"
        accessibilityRole="button"
        disabled={disabled}
        onPress={onRight}
        style={({ pressed }) => [
          styles.button,
          styles.right,
          pressed && styles.pressed,
        ]}
      >
        <AppText style={styles.arrow}>→</AppText>
      </Pressable>
      <Pressable
        accessibilityLabel="Move selected tile down"
        accessibilityRole="button"
        disabled={disabled}
        onPress={onDown}
        style={({ pressed }) => [
          styles.button,
          styles.down,
          pressed && styles.pressed,
        ]}
      >
        <AppText style={styles.arrow}>↓</AppText>
      </Pressable>
      <Pressable
        accessibilityLabel="Move selected tile left"
        accessibilityRole="button"
        disabled={disabled}
        onPress={onLeft}
        style={({ pressed }) => [
          styles.button,
          styles.left,
          pressed && styles.pressed,
        ]}
      >
        <AppText style={styles.arrow}>←</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: { color: colors.text, fontSize: 32, lineHeight: 36 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    position: 'absolute',
  },
  control: {
    alignSelf: 'center',
    height: 168,
    position: 'relative',
    width: 168,
  },
  down: { bottom: 0, height: 48, left: 48, width: 72 },
  left: { height: 72, left: 0, top: 48, width: 48 },
  pressed: { backgroundColor: colors.primaryPressed },
  right: { height: 72, right: 0, top: 48, width: 48 },
  up: { height: 48, left: 48, top: 0, width: 72 },
});
