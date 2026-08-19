import type { ComponentProps } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, layout } from '../../theme/tokens';
import { AppText } from './AppText';

type FormFieldProps = Omit<
  ComponentProps<typeof TextInput>,
  'accessibilityLabel'
> & {
  error?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  helperText?: string;
  label: string;
};

export const FormField = ({
  containerStyle,
  error = false,
  helperText,
  label,
  style,
  ...props
}: FormFieldProps) => (
  <View style={[styles.container, containerStyle]}>
    <AppText style={error ? styles.errorText : undefined} tone="label">
      {label}
    </AppText>
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={colors.mutedText}
      selectionColor={colors.primary}
      style={[styles.input, error && styles.errorInput, style]}
      {...props}
    />
    {helperText ? (
      <AppText style={error ? styles.errorText : styles.helper}>
        {helperText}
      </AppText>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  errorInput: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
  },
  helper: {
    color: colors.mutedText,
    fontSize: 13,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
