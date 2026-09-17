import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
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
  const [expanded, setExpanded] = useState(false);
  const { errors } = resolveTargetFilterInputs(
    discovery.filterInputs,
    discovery.filterLimits,
  );
  const activeCount = Object.entries(discovery.filterLimits).filter(
    ([key, value]) =>
      value !== null && (hasEquipment || key === 'minDurationMinutes'),
  ).length;
  return (
    <View>
      <Pressable
        accessibilityLabel="Advanced"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={styles.disclosure}
      >
        <AppText tone="label">
          Advanced{activeCount > 0 ? ` (${activeCount})` : ''}
        </AppText>
        <AppText tone="muted">{expanded ? '⌃' : '⌄'}</AppText>
      </Pressable>
      {expanded ? (
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
            <AppText tone="muted">
              Select optics to filter by pixel size.
            </AppText>
          ) : null}
          <FilterField
            field={fields[2]}
            discovery={discovery}
            error={errors.minDurationMinutes}
          />
        </View>
      ) : null}
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
    <View style={styles.field}>
      <View style={[styles.inputRow, disabled && styles.disabled]}>
        <AppText style={styles.label}>{field.label}</AppText>
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
        <AppText style={styles.unit} tone="muted">
          {field.unit}
        </AppText>
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
  disclosure: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: layout.minimumTouchTarget,
  },
  fields: { gap: 8 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flexGrow: 1, minWidth: 140 },
  inputRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  label: { fontSize: 12 },
  unit: { fontSize: 12 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    minWidth: 48,
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 6,
  },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 12 },
});
