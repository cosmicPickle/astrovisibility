import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '../components/ui/ActionButton';
import { AppScreen } from '../components/ui/AppScreen';
import { AppText } from '../components/ui/AppText';
import { FormField } from '../components/ui/FormField';
import { SectionCard } from '../components/ui/SectionCard';
import { colors } from '../theme/tokens';
import {
  parseProfileForm,
  type ProfileFormData,
  type ProfileFormValues,
} from './profileForm';
import {
  expoProfileLocationClient,
  type ProfileLocationClient,
} from './profileLocation';

interface ProfileFormProps {
  initialValues: ProfileFormValues;
  locationClient?: ProfileLocationClient;
  onSave: (data: ProfileFormData) => Promise<void> | void;
  title: string;
}

export const ProfileForm = ({
  initialValues,
  locationClient = expoProfileLocationClient,
  onSave,
  title,
}: ProfileFormProps) => {
  const [values, setValues] = useState(initialValues);
  const [fieldError, setFieldError] = useState<{
    field: keyof ProfileFormValues;
    message: string;
  } | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [canAskForLocationAgain, setCanAskForLocationAgain] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateValue = (
    field: keyof ProfileFormValues,
    value: string | number | null,
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (fieldError?.field === field) setFieldError(null);
    if (field === 'latitudeDegreesNorth' || field === 'longitudeDegreesEast') {
      setValues((current) => ({ ...current, locationAccuracyMeters: null }));
      setLocationMessage(null);
    }
  };

  const requestCurrentLocation = async () => {
    setLocating(true);
    setLocationMessage(null);
    const result = await locationClient.requestCurrentLocation();
    if (result.status === 'granted') {
      setValues((current) => ({
        ...current,
        latitudeDegreesNorth: String(result.latitudeDegreesNorth),
        longitudeDegreesEast: String(result.longitudeDegreesEast),
        elevationMetersAboveMeanSeaLevel: String(
          result.elevationMetersAboveMeanSeaLevel,
        ),
        locationAccuracyMeters: result.locationAccuracyMeters,
      }));
      setLocationMessage(
        result.locationAccuracyMeters === null
          ? 'Location acquired. Review it before saving.'
          : `Location acquired within about ${Math.round(result.locationAccuracyMeters)} m.`,
      );
    } else if (result.status === 'denied') {
      setCanAskForLocationAgain(result.canAskAgain);
      setLocationMessage(
        'Location permission was denied. Enter coordinates manually or retry.',
      );
    } else {
      setLocationMessage(result.message);
    }
    setLocating(false);
  };

  const submit = async () => {
    const parsed = parseProfileForm(values);
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
        'The profile could not be saved locally. Your entered values are still here; try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldMessage = (field: keyof ProfileFormValues) =>
    fieldError?.field === field ? fieldError.message : undefined;

  return (
    <AppScreen>
      <View style={styles.heading}>
        <AppText tone="title">{title}</AppText>
        <AppText tone="muted">
          One profile represents one exact observing position. Everything stays
          on this device.
        </AppText>
      </View>

      <SectionCard>
        <AppText tone="label">Location helper</AppText>
        <AppText>
          Astrovisibility requests foreground location only when you press the
          button. It saves one accepted position and does not track you.
        </AppText>
        <ActionButton
          label={locating ? 'Finding location…' : 'Use current location'}
          loading={locating}
          onPress={() => void requestCurrentLocation()}
          variant="secondary"
        />
        {locationMessage ? (
          <AppText style={styles.statusText}>{locationMessage}</AppText>
        ) : null}
        {!canAskForLocationAgain ? (
          <ActionButton
            label="Open app settings"
            onPress={() => void locationClient.openSettings()}
            variant="text"
          />
        ) : null}
      </SectionCard>

      <SectionCard>
        <AppText tone="label">Profile details</AppText>
        <FormField
          autoCapitalize="words"
          error={Boolean(fieldMessage('name'))}
          helperText={fieldMessage('name')}
          label="Profile name"
          onChangeText={(value) => updateValue('name', value)}
          placeholder="Bedroom window"
          value={values.name}
        />
        <View style={styles.coordinateRow}>
          <FormField
            containerStyle={styles.fieldColumn}
            error={Boolean(fieldMessage('latitudeDegreesNorth'))}
            helperText={
              fieldMessage('latitudeDegreesNorth') ?? 'North positive'
            }
            inputMode="decimal"
            keyboardType="numbers-and-punctuation"
            label="Latitude"
            onChangeText={(value) => updateValue('latitudeDegreesNorth', value)}
            placeholder="42.6977"
            style={styles.numericInput}
            value={values.latitudeDegreesNorth}
          />
          <FormField
            containerStyle={styles.fieldColumn}
            error={Boolean(fieldMessage('longitudeDegreesEast'))}
            helperText={fieldMessage('longitudeDegreesEast') ?? 'East positive'}
            inputMode="decimal"
            keyboardType="numbers-and-punctuation"
            label="Longitude"
            onChangeText={(value) => updateValue('longitudeDegreesEast', value)}
            placeholder="23.3219"
            style={styles.numericInput}
            value={values.longitudeDegreesEast}
          />
        </View>
        <FormField
          error={Boolean(fieldMessage('elevationMetersAboveMeanSeaLevel'))}
          helperText={
            fieldMessage('elevationMetersAboveMeanSeaLevel') ??
            'Metres above mean sea level; blank uses 0'
          }
          inputMode="decimal"
          keyboardType="numbers-and-punctuation"
          label="Elevation"
          onChangeText={(value) =>
            updateValue('elevationMetersAboveMeanSeaLevel', value)
          }
          placeholder="550"
          value={values.elevationMetersAboveMeanSeaLevel}
        />
        <FormField
          autoCapitalize="none"
          autoCorrect={false}
          error={Boolean(fieldMessage('timeZoneId'))}
          helperText={
            fieldMessage('timeZoneId') ?? 'IANA name used for observing dates'
          }
          label="Timezone"
          onChangeText={(value) => updateValue('timeZoneId', value)}
          placeholder="Europe/Sofia"
          value={values.timeZoneId}
        />
      </SectionCard>

      {saveError ? (
        <AppText accessibilityLiveRegion="polite" style={styles.errorText}>
          {saveError}
        </AppText>
      ) : null}
      <ActionButton
        label={saving ? 'Saving profile…' : 'Save profile'}
        loading={saving}
        onPress={() => void submit()}
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  coordinateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  errorText: {
    color: colors.danger,
  },
  fieldColumn: {
    flex: 1,
  },
  heading: {
    gap: 7,
  },
  numericInput: {
    minWidth: 0,
  },
  statusText: {
    color: colors.mutedText,
  },
});
