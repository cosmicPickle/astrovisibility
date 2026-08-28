import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '../components/ui/ActionButton';
import { AppScreen } from '../components/ui/AppScreen';
import { AppText } from '../components/ui/AppText';
import { FormField } from '../components/ui/FormField';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SectionCard } from '../components/ui/SectionCard';
import { colors } from '../theme/tokens';
import {
  deviceTimeZoneId,
  parseProfileForm,
  type ProfileFormData,
  type ProfileFormValues,
} from './profileForm';
import {
  expoProfileLocationClient,
  type ProfileLocationClient,
} from './profileLocation';
import { TimeZonePicker } from './TimeZonePicker';
import { ianaTimeZoneOptions } from './timeZones';

type LocationMode = 'current' | 'custom';
type TimeZoneMode = 'current' | 'custom';

const locationOptions = [
  {
    accessibilityLabel: 'Use current location',
    label: 'Current',
    value: 'current',
  },
  {
    accessibilityLabel: 'Use custom location',
    label: 'Custom',
    value: 'custom',
  },
] as const;

const timeZoneModeOptions = [
  {
    accessibilityLabel: 'Use current timezone',
    label: 'Current',
    value: 'current',
  },
  {
    accessibilityLabel: 'Use custom timezone',
    label: 'Custom',
    value: 'custom',
  },
] as const;

interface ProfileFormProps {
  initialValues: ProfileFormValues;
  locationClient?: ProfileLocationClient;
  currentTimeZoneId?: string;
  onSave: (data: ProfileFormData) => Promise<void> | void;
  timeZoneOptions?: readonly string[];
  title: string;
}

export const ProfileForm = ({
  currentTimeZoneId = deviceTimeZoneId(),
  initialValues,
  locationClient = expoProfileLocationClient,
  onSave,
  timeZoneOptions = ianaTimeZoneOptions,
  title,
}: ProfileFormProps) => {
  const hasSavedCoordinates =
    initialValues.latitudeDegreesNorth.trim() !== '' &&
    initialValues.longitudeDegreesEast.trim() !== '';
  const [values, setValues] = useState(initialValues);
  const [locationMode, setLocationMode] = useState<LocationMode>(
    hasSavedCoordinates ? 'custom' : 'current',
  );
  const [timeZoneMode, setTimeZoneMode] = useState<TimeZoneMode>(
    initialValues.timeZoneId === currentTimeZoneId ? 'current' : 'custom',
  );
  const [fieldError, setFieldError] = useState<{
    field: keyof ProfileFormValues;
    message: string;
  } | null>(null);
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
    }
  };

  const requestCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
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
        setLocationMode('current');
      } else {
        setLocationMode('custom');
        setValues((current) => ({
          ...current,
          locationAccuracyMeters: null,
        }));
      }
    } catch {
      setLocationMode('custom');
      setValues((current) => ({
        ...current,
        locationAccuracyMeters: null,
      }));
    } finally {
      setLocating(false);
    }
  }, [locationClient]);

  const requestedInitialLocation = useRef(false);
  useEffect(() => {
    if (!hasSavedCoordinates && !requestedInitialLocation.current) {
      requestedInitialLocation.current = true;
      void requestCurrentLocation();
    }
  }, [hasSavedCoordinates, requestCurrentLocation]);

  const changeLocationMode = (mode: LocationMode) => {
    if (mode === 'current') {
      void requestCurrentLocation();
      return;
    }
    setLocationMode('custom');
    setValues((current) => ({
      ...current,
      locationAccuracyMeters: null,
    }));
  };

  const changeTimeZoneMode = (mode: TimeZoneMode) => {
    setTimeZoneMode(mode);
    if (mode === 'current') updateValue('timeZoneId', currentTimeZoneId);
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
        <AppText tone="label">Profile details</AppText>
        <FormField
          autoCapitalize="words"
          error={Boolean(fieldMessage('name'))}
          helperText={fieldMessage('name')}
          label="Profile name"
          onChangeText={(value) => updateValue('name', value)}
          value={values.name}
        />
        <AppText tone="label">Location</AppText>
        <SegmentedControl
          onChange={changeLocationMode}
          options={locationOptions}
          value={locationMode}
        />
        {locationMode === 'custom' ? (
          <>
            <View style={styles.coordinateRow}>
              <FormField
                containerStyle={styles.fieldColumn}
                error={Boolean(fieldMessage('latitudeDegreesNorth'))}
                helperText={fieldMessage('latitudeDegreesNorth')}
                inputMode="decimal"
                keyboardType="numbers-and-punctuation"
                label="Latitude"
                onChangeText={(value) =>
                  updateValue('latitudeDegreesNorth', value)
                }
                style={styles.numericInput}
                value={values.latitudeDegreesNorth}
              />
              <FormField
                containerStyle={styles.fieldColumn}
                error={Boolean(fieldMessage('longitudeDegreesEast'))}
                helperText={fieldMessage('longitudeDegreesEast')}
                inputMode="decimal"
                keyboardType="numbers-and-punctuation"
                label="Longitude"
                onChangeText={(value) =>
                  updateValue('longitudeDegreesEast', value)
                }
                style={styles.numericInput}
                value={values.longitudeDegreesEast}
              />
            </View>
            <FormField
              error={Boolean(fieldMessage('elevationMetersAboveMeanSeaLevel'))}
              helperText={fieldMessage('elevationMetersAboveMeanSeaLevel')}
              inputMode="decimal"
              keyboardType="numbers-and-punctuation"
              label="Elevation"
              onChangeText={(value) =>
                updateValue('elevationMetersAboveMeanSeaLevel', value)
              }
              value={values.elevationMetersAboveMeanSeaLevel}
            />
          </>
        ) : null}
        <AppText tone="label">Timezone</AppText>
        <SegmentedControl
          onChange={changeTimeZoneMode}
          options={timeZoneModeOptions}
          value={timeZoneMode}
        />
        {timeZoneMode === 'custom' ? (
          <View style={styles.timeZoneField}>
            <TimeZonePicker
              onChange={(value) => updateValue('timeZoneId', value)}
              options={timeZoneOptions}
              value={values.timeZoneId}
            />
            {fieldMessage('timeZoneId') ? (
              <AppText style={styles.errorText}>
                {fieldMessage('timeZoneId')}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </SectionCard>

      {saveError ? (
        <AppText accessibilityLiveRegion="polite" style={styles.errorText}>
          {saveError}
        </AppText>
      ) : null}
      <ActionButton
        label={saving ? 'Saving profile…' : 'Save profile'}
        loading={saving || locating}
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
  timeZoneField: { gap: 6 },
});
