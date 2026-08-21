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
      style={styles.donut}
    >
      <Pressable
        accessibilityLabel="Move selected tile up"
        accessibilityRole="button"
        disabled={disabled}
        onPress={onUp}
        style={({ pressed }) => [
          styles.quadrant,
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
          styles.quadrant,
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
          styles.quadrant,
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
          styles.quadrant,
          styles.left,
          pressed && styles.pressed,
        ]}
      >
        <AppText style={styles.arrow}>←</AppText>
      </Pressable>
      <View pointerEvents="none" style={styles.hub} />
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: { fontSize: 28, lineHeight: 32 },
  donut: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 84,
    borderWidth: 2,
    height: 168,
    overflow: 'hidden',
    position: 'relative',
    width: 168,
  },
  down: { bottom: 0, left: 42 },
  hub: {
    backgroundColor: colors.background,
    borderColor: colors.primary,
    borderRadius: 30,
    borderWidth: 2,
    height: 60,
    left: 52,
    position: 'absolute',
    top: 52,
    width: 60,
  },
  left: { left: 0, top: 42 },
  pressed: { backgroundColor: colors.primaryPressed },
  quadrant: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderWidth: 0.5,
    height: 84,
    justifyContent: 'center',
    opacity: 1,
    position: 'absolute',
    width: 84,
  },
  right: { right: 0, top: 42 },
  up: { left: 42, top: 0 },
});
