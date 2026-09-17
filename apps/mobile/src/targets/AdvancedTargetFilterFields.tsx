import { StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '../components/ui/AppText';
import { colors, layout } from '../theme/tokens';
import {
  resolveTargetFilterInputs,
  type TargetFilterInputs,
} from './advancedTargetFilters';
import type { useTargetDiscoveryState } from './targetDiscoveryState';

const fields = [
  {
    key: 'minSizePixels',
    label: 'Min size',
    unit: 'px',
    accessibleUnit: 'pixels',
  },
  {
    key: 'maxSizePixels',
    label: 'Max size',
    unit: 'px',
    accessibleUnit: 'pixels',
  },
  {
    key: 'minDurationMinutes',
    label: 'Min visibility duration',
    unit: 'minutes',
    accessibleUnit: 'minutes',
  },
] as const;

export function AdvancedTargetFilterFields({
  discovery,
  hasEquipment,
}: Readonly<{
  discovery: ReturnType<typeof useTargetDiscoveryState>;
  hasEquipment: boolean;
}>) {
  const { errors } = resolveTargetFilterInputs(
    discovery.filterInputs,
    discovery.filterLimits,
  );
  return (
    <View style={styles.fields}>
      <View style={styles.sizeRow}>
        {fields.slice(0, 2).map((field) => (
          <FilterField
            key={field.key}
            field={field}
            discovery={discovery}
            disabled={!hasEquipment}
            error={hasEquipment ? errors[field.key] : undefined}
          />
        ))}
      </View>
      {!hasEquipment ? (
        <AppText tone="muted">Select optics to filter by pixel size.</AppText>
      ) : null}
      <FilterField
        field={fields[2]}
        discovery={discovery}
        error={errors.minDurationMinutes}
      />
    </View>
  );
}

function FilterField({
  field,
  discovery,
  disabled = false,
  error,
}: Readonly<{
  field: {
    key: keyof TargetFilterInputs;
    label: string;
    unit: string;
    accessibleUnit: string;
  };
  discovery: ReturnType<typeof useTargetDiscoveryState>;
  disabled?: boolean;
  error?: string;
}>) {
  return (
    <View
      style={[
        styles.field,
        field.key !== 'minDurationMinutes' && styles.sizeField,
      ]}
    >
      <View style={[styles.inputRow, disabled && styles.disabled]}>
        <View style={styles.cap}>
          <AppText style={styles.label}>{field.label}</AppText>
        </View>
        <TextInput
          accessibilityLabel={`${field.label} in ${field.accessibleUnit}`}
          accessibilityState={{ disabled }}
          editable={!disabled}
          inputMode="decimal"
          maxLength={16}
          onChangeText={(value) => discovery.setFilterInput(field.key, value)}
          style={styles.input}
          value={discovery.filterInputs[field.key]}
        />
        <View style={styles.cap}>
          <AppText style={styles.label}>{field.unit}</AppText>
        </View>
      </View>
      {error ? (
        <AppText accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 8 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flexGrow: 1, minWidth: 140 },
  sizeField: { flexBasis: 0 },
  inputRow: {
    flexDirection: 'row',
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cap: {
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    flexShrink: 1,
  },
  label: { fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    color: colors.text,
    flex: 1,
    minWidth: 44,
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 12 },
});
