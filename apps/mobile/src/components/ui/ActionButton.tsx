import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { colors, layout } from '../../theme/tokens';
import { AppText } from './AppText';

type ActionButtonProps = Omit<ComponentProps<typeof Pressable>, 'children'> & {
  label: string;
  loading?: boolean;
  variant?: 'danger' | 'primary' | 'secondary' | 'text';
};

export const ActionButton = ({
  disabled = false,
  label,
  loading = false,
  style,
  variant = 'primary',
  ...props
}: ActionButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: disabled || loading }}
    disabled={disabled || loading}
    style={(state) => [
      styles.base,
      styles[variant],
      state.pressed && styles.pressed,
      (disabled || loading) && styles.disabled,
      typeof style === 'function' ? style(state) : style,
    ]}
    {...props}
  >
    {loading ? (
      <ActivityIndicator
        color={variant === 'primary' ? colors.onPrimary : colors.primary}
        size="small"
      />
    ) : (
      <AppText
        style={variant === 'primary' ? styles.primaryText : styles.buttonText}
      >
        {label}
      </AppText>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: layout.controlRadius,
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: colors.text,
    fontWeight: '700',
  },
  danger: {
    backgroundColor: 'rgba(255, 107, 120, 0.10)',
    borderColor: colors.danger,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.46,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderWidth: 1,
  },
  text: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.78,
  },
});
