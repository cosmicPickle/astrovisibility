import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '../components/ui/ActionButton';
import { AppScreen } from '../components/ui/AppScreen';
import { AppText } from '../components/ui/AppText';
import { FormField } from '../components/ui/FormField';
import { SectionCard } from '../components/ui/SectionCard';
import { colors } from '../theme/tokens';
import {
  calculateEquipmentPreview,
  parseEquipmentForm,
  type EquipmentFormData,
  type EquipmentFormValues,
} from './equipmentForm';

interface EquipmentFormProps {
  initialValues: EquipmentFormValues;
  onSave: (data: EquipmentFormData) => Promise<void> | void;
  title: string;
}

export const EquipmentForm = ({
  initialValues,
  onSave,
  title,
}: EquipmentFormProps) => {
  const [values, setValues] = useState(initialValues);
  const [fieldError, setFieldError] = useState<{
    field: keyof EquipmentFormValues;
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const parsed = parseEquipmentForm({
      ...values,
      name: values.name.trim() || 'Preview',
    });
    return parsed.success ? calculateEquipmentPreview(parsed.data) : null;
  }, [values]);

  const updateValue = (field: keyof EquipmentFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (fieldError?.field === field) setFieldError(null);
  };

  const submit = async () => {
    const parsed = parseEquipmentForm(values);
    if (!parsed.success) {
      setFieldError({ field: parsed.field, message: parsed.message });
      return;
    }
    setFieldError(null);
    setSaveError(null);
    setSaving(true);
    try {
      await onSave(parsed.data);
    } catch {
      setSaveError(
        'The imaging setup could not be saved locally. Your entered values are still here; try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldMessage = (field: keyof EquipmentFormValues) =>
    fieldError?.field === field ? fieldError.message : undefined;

  return (
    <AppScreen>
      <View style={styles.heading}>
        <AppText tone="title">{title}</AppText>
        <AppText tone="muted">
          Enter the optical train you actually use. The frame preview updates as
          you type.
        </AppText>
      </View>

      <SectionCard>
        <AppText tone="label">Imaging setup</AppText>
        <FormField
          autoCapitalize="words"
          error={Boolean(fieldMessage('name'))}
          helperText={fieldMessage('name')}
          label="Setup name"
          onChangeText={(value) => updateValue('name', value)}
          placeholder="Wide-field refractor"
          value={values.name}
        />
        <View style={styles.fieldRow}>
          <FormField
            containerStyle={styles.fieldColumn}
            error={Boolean(fieldMessage('focalLengthMillimeters'))}
            helperText={fieldMessage('focalLengthMillimeters') ?? 'Millimetres'}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label="Focal length"
            onChangeText={(value) =>
              updateValue('focalLengthMillimeters', value)
            }
            value={values.focalLengthMillimeters}
          />
          <FormField
            containerStyle={styles.fieldColumn}
            error={Boolean(fieldMessage('apertureMillimeters'))}
            helperText={fieldMessage('apertureMillimeters') ?? 'Millimetres'}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label="Aperture"
            onChangeText={(value) => updateValue('apertureMillimeters', value)}
            value={values.apertureMillimeters}
          />
        </View>
        <View style={styles.fieldRow}>
          <FormField
            containerStyle={styles.fieldColumn}
            error={Boolean(fieldMessage('sensorWidthMillimeters'))}
            helperText={fieldMessage('sensorWidthMillimeters') ?? 'Millimetres'}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label="Sensor width"
            onChangeText={(value) =>
              updateValue('sensorWidthMillimeters', value)
            }
            value={values.sensorWidthMillimeters}
          />
          <FormField
            containerStyle={styles.fieldColumn}
            error={Boolean(fieldMessage('sensorHeightMillimeters'))}
            helperText={
              fieldMessage('sensorHeightMillimeters') ?? 'Millimetres'
            }
            inputMode="decimal"
            keyboardType="decimal-pad"
            label="Sensor height"
            onChangeText={(value) =>
              updateValue('sensorHeightMillimeters', value)
            }
            value={values.sensorHeightMillimeters}
          />
        </View>
        <View style={styles.fieldRow}>
          <FormField
            containerStyle={styles.fieldColumn}
            error={Boolean(fieldMessage('pixelSizeMicrometers'))}
            helperText={fieldMessage('pixelSizeMicrometers') ?? 'Micrometres'}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label="Pixel size"
            onChangeText={(value) => updateValue('pixelSizeMicrometers', value)}
            value={values.pixelSizeMicrometers}
          />
          <FormField
            containerStyle={styles.fieldColumn}
            error={Boolean(fieldMessage('frameRotationDegrees'))}
            helperText={fieldMessage('frameRotationDegrees') ?? 'Degrees'}
            inputMode="decimal"
            keyboardType="numbers-and-punctuation"
            label="Frame rotation"
            onChangeText={(value) => updateValue('frameRotationDegrees', value)}
            value={values.frameRotationDegrees}
          />
        </View>
      </SectionCard>

      <SectionCard>
        <AppText tone="label">Derived frame</AppText>
        {preview ? (
          <>
            <AppText style={styles.previewMetric}>
              {preview.horizontalFovDegrees.toFixed(2)}° ×{' '}
              {preview.verticalFovDegrees.toFixed(2)}°
            </AppText>
            <AppText tone="muted">
              Approximately {Math.round(preview.pixelWidth)} ×{' '}
              {Math.round(preview.pixelHeight)} pixels
            </AppText>
          </>
        ) : (
          <AppText tone="muted">
            Complete the positive optical and sensor values to preview the field
            of view.
          </AppText>
        )}
      </SectionCard>

      {saveError ? (
        <AppText accessibilityLiveRegion="polite" style={styles.errorText}>
          {saveError}
        </AppText>
      ) : null}
      <ActionButton
        label={saving ? 'Saving setup…' : 'Save setup'}
        loading={saving}
        onPress={() => void submit()}
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: colors.danger,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldColumn: {
    flex: 1,
  },
  heading: {
    gap: 7,
  },
  previewMetric: {
    fontSize: 22,
    fontWeight: '800',
  },
});
