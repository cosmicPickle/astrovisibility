import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';

export function PanoramaRecordButton({
  recording,
  busy,
  onPress,
}: {
  recording: boolean;
  busy: boolean;
  onPress(): void;
}) {
  const label = recording ? 'Stop panorama' : 'Start panorama';
  return (
    <Pressable
      accessibilityLabel={busy ? 'Processing panorama' : label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        busy && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={[styles.record, recording && styles.stop]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.text,
    backgroundColor: colors.backdrop,
  },
  record: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.danger,
  },
  stop: { width: 28, height: 28, borderRadius: 4 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.46 },
});
