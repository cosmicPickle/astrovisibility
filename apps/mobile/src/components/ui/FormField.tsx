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
  showLabel?: boolean;
  unit?: string;
};

export const FormField = ({
  containerStyle,
  error = false,
  helperText,
  label,
  showLabel = true,
  style,
  unit,
  ...props
}: FormFieldProps) => (
  <View style={[styles.container, containerStyle]}>
    {showLabel ? (
      <AppText style={error ? styles.errorText : undefined} tone="label">
        {label}
      </AppText>
    ) : null}
    {unit ? (
      <View style={[styles.unitField, error && styles.errorInput]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.mutedText}
          selectionColor={colors.primary}
          style={[styles.unitInput, style]}
          {...props}
        />
        <AppText style={styles.unit}>{unit}</AppText>
      </View>
    ) : (
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.mutedText}
        selectionColor={colors.primary}
        style={[styles.input, error && styles.errorInput, style]}
        {...props}
      />
    )}
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
  unit: {
    color: colors.mutedText,
    paddingRight: 12,
  },
  unitField: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 46,
  },
  unitInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
