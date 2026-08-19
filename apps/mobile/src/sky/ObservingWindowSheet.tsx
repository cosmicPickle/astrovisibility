import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  createCustomWindowFromForm,
  parseLocalCivilDate,
  type CustomObservingWindowFormValues,
} from '../astronomy/observingWindowForm';
import {
  formatLocalDateInput,
  formatLocalTimeInput,
  formatObservingWindowRange,
} from '../astronomy/observingWindowPresentation';
import { createTonightObservingWindow } from '../astronomy/observingWindow';
import {
  localCivilDateTimeAtInstant,
  type AmbiguousTimeChoice,
  type ObservingWindow,
} from '../astronomy/localCivilTime';
import type { ObserverLocation } from '../astronomy/horizontalCoordinates';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { FormField } from '../components/ui/FormField';
import { ModalSheet } from '../components/ui/ModalSheet';
import { colors } from '../theme/tokens';

type WindowMode = 'tonight' | 'custom';

const formFromWindow = (
  window: ObservingWindow,
  timeZoneId: string,
): Omit<CustomObservingWindowFormValues, 'timeZoneId'> => {
  const start = localCivilDateTimeAtInstant(
    window.startTimestampUtc,
    timeZoneId,
  );
  const end = localCivilDateTimeAtInstant(window.endTimestampUtc, timeZoneId);
  return {
    startDate: formatLocalDateInput(start),
    startTime: formatLocalTimeInput(start),
    endDate: formatLocalDateInput(end),
    endTime: formatLocalTimeInput(end),
  };
};

const issueMessage = (issue: string) => {
  switch (issue) {
    case 'invalidStartDate':
      return 'Enter the start date as YYYY-MM-DD.';
    case 'invalidStartTime':
      return 'Enter the start time as HH:mm.';
    case 'invalidEndDate':
      return 'Enter the end date as YYYY-MM-DD.';
    case 'invalidEndTime':
      return 'Enter the end time as HH:mm.';
    case 'startGap':
      return 'That start time does not exist because the clocks move forward.';
    case 'endGap':
      return 'That end time does not exist because the clocks move forward.';
    case 'startAmbiguous':
      return 'The start time occurs twice. Choose its first or second occurrence.';
    case 'endAmbiguous':
      return 'The end time occurs twice. Choose its first or second occurrence.';
    case 'endNotAfterStart':
      return 'End must be after start.';
    case 'durationExceeds24Hours':
      return 'The observing interval cannot exceed 24 hours.';
    default:
      return 'The observing window could not be applied.';
  }
};

type ObservingWindowSheetProps = {
  observer: ObserverLocation;
  onApply: (window: ObservingWindow) => Promise<boolean>;
  onClose: () => void;
  timeZoneId: string;
  visible: boolean;
  window: ObservingWindow;
};

export const ObservingWindowSheet = (props: ObservingWindowSheetProps) =>
  props.visible ? <VisibleObservingWindowSheet {...props} /> : null;

const VisibleObservingWindowSheet = ({
  observer,
  onApply,
  onClose,
  timeZoneId,
  window,
}: Omit<ObservingWindowSheetProps, 'visible'>) => {
  const [mode, setMode] = useState<WindowMode>(
    window.kind === 'custom' ? 'custom' : 'tonight',
  );
  const [form, setForm] = useState(() => formFromWindow(window, timeZoneId));
  const [tonightDate, setTonightDate] = useState(form.startDate);
  const [startAmbiguity, setStartAmbiguity] = useState<AmbiguousTimeChoice>();
  const [endAmbiguity, setEndAmbiguity] = useState<AmbiguousTimeChoice>();
  const [issue, setIssue] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setIssue(null);
    if (field.startsWith('start')) setStartAmbiguity(undefined);
    if (field.startsWith('end')) setEndAmbiguity(undefined);
  };

  const applyWindow = async (nextWindow: ObservingWindow) => {
    setSubmitting(true);
    const applied = await onApply(nextWindow);
    setSubmitting(false);
    if (!applied) setIssue('applyFailed');
  };

  const applyTonight = () => {
    const civilDate = parseLocalCivilDate(tonightDate);
    if (!civilDate) {
      setIssue('invalidTonightDate');
      return;
    }
    void applyWindow(
      createTonightObservingWindow({ civilDate, observer, timeZoneId }),
    );
  };

  const applyCustom = () => {
    const result = createCustomWindowFromForm({
      ...form,
      timeZoneId,
      startAmbiguity,
      endAmbiguity,
    });
    if (!result.success) {
      setIssue(result.issue);
      return;
    }
    void applyWindow(result.window);
  };

  return (
    <ModalSheet
      closeAccessibilityLabel="Close time sheet"
      onClose={onClose}
      title="Observing window"
      visible
    >
      <AppText tone="muted">
        Times use {timeZoneId}. Calculations use the corresponding UTC instants.
      </AppText>
      <View style={styles.modeRow}>
        <ActionButton
          label="Tonight"
          onPress={() => {
            setMode('tonight');
            setIssue(null);
          }}
          style={styles.modeButton}
          variant={mode === 'tonight' ? 'primary' : 'secondary'}
        />
        <ActionButton
          label="Custom interval"
          onPress={() => {
            setMode('custom');
            setIssue(null);
          }}
          style={styles.modeButton}
          variant={mode === 'custom' ? 'primary' : 'secondary'}
        />
      </View>

      {mode === 'tonight' ? (
        <>
          <FormField
            autoCapitalize="none"
            label="Tonight date"
            onChangeText={(value) => {
              setTonightDate(value);
              setIssue(null);
            }}
            value={tonightDate}
          />
          <AppText tone="muted">
            Uses astronomical dusk through dawn. Polar dates fall back to
            sunset–sunrise, then 18:00–06:00 when solar crossings are absent.
          </AppText>
          <ActionButton
            label="Use Tonight"
            loading={submitting}
            onPress={applyTonight}
          />
        </>
      ) : (
        <>
          <View style={styles.fieldRow}>
            <FormField
              containerStyle={styles.dateField}
              label="Start date"
              onChangeText={(value) => updateForm('startDate', value)}
              value={form.startDate}
            />
            <FormField
              containerStyle={styles.timeField}
              label="Start time"
              onChangeText={(value) => updateForm('startTime', value)}
              value={form.startTime}
            />
          </View>
          {issue === 'startAmbiguous' ? (
            <AmbiguityChoice
              label="Start repeated-time choice"
              onChange={setStartAmbiguity}
              value={startAmbiguity}
            />
          ) : null}
          <View style={styles.fieldRow}>
            <FormField
              containerStyle={styles.dateField}
              label="End date"
              onChangeText={(value) => updateForm('endDate', value)}
              value={form.endDate}
            />
            <FormField
              containerStyle={styles.timeField}
              label="End time"
              onChangeText={(value) => updateForm('endTime', value)}
              value={form.endTime}
            />
          </View>
          {issue === 'endAmbiguous' ? (
            <AmbiguityChoice
              label="End repeated-time choice"
              onChange={setEndAmbiguity}
              value={endAmbiguity}
            />
          ) : null}
          <AppText tone="muted">Maximum elapsed duration: 24 hours.</AppText>
          <ActionButton
            label="Apply interval"
            loading={submitting}
            onPress={applyCustom}
          />
        </>
      )}

      {issue ? (
        <AppText accessibilityLiveRegion="polite" style={styles.errorText}>
          {issue === 'invalidTonightDate'
            ? 'Enter the Tonight date as YYYY-MM-DD.'
            : issueMessage(issue)}
        </AppText>
      ) : null}

      <View style={styles.currentWindow}>
        <AppText tone="label">Current window</AppText>
        <AppText>{formatObservingWindowRange(window, timeZoneId)}</AppText>
        {window.note ? (
          <AppText style={styles.note}>{window.note}</AppText>
        ) : null}
        {window.warnings.map((warning) => (
          <AppText key={warning} style={styles.warning}>
            {warning}
          </AppText>
        ))}
      </View>
    </ModalSheet>
  );
};

const AmbiguityChoice = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: AmbiguousTimeChoice) => void;
  value: AmbiguousTimeChoice | undefined;
}) => (
  <View style={styles.ambiguity}>
    <AppText style={styles.warning}>{label}</AppText>
    <View style={styles.modeRow}>
      <ActionButton
        label="First occurrence"
        onPress={() => onChange('earlier')}
        style={styles.modeButton}
        variant={value === 'earlier' ? 'primary' : 'secondary'}
      />
      <ActionButton
        label="Second occurrence"
        onPress={() => onChange('later')}
        style={styles.modeButton}
        variant={value === 'later' ? 'primary' : 'secondary'}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  ambiguity: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    gap: 8,
    padding: 10,
  },
  currentWindow: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    gap: 4,
    padding: 12,
  },
  dateField: { flex: 1.45 },
  errorText: { color: colors.danger },
  fieldRow: { flexDirection: 'row', gap: 10 },
  modeButton: { flex: 1 },
  modeRow: { flexDirection: 'row', gap: 8 },
  note: { color: colors.warning },
  timeField: { flex: 1 },
  warning: { color: colors.warning },
});
