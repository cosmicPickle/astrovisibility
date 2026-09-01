import { useMemo, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
  Svg,
} from 'react-native-svg';

import type { ObserverLocation } from '../astronomy/horizontalCoordinates';
import {
  addDaysToLocalDate,
  localCivilDateTimeAtInstant,
  type LocalCivilDate,
  type ObservingWindow,
} from '../astronomy/localCivilTime';
import {
  createAstronomicalDarknessSpan,
  createMoonConditions,
  createSkyConditionTrack,
  type AstronomicalDarknessSpan,
} from '../astronomy/observingConditions';
import {
  clampNoonCenteredTrackEndTimestamp,
  createDateObservingWindow,
  getNoonCenteredObservingDate,
  getNoonCenteredSliderMinute,
  resolveNoonCenteredSliderTimestamp,
} from '../astronomy/observingWindow';
import { formatLocalTimeInput } from '../astronomy/observingWindowPresentation';
import { ActionButton } from '../components/ui/ActionButton';
import { AppIcon } from '../components/ui/AppIcon';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { colors, layout } from '../theme/tokens';
import { MoonPhaseIcon } from './MoonPhaseIcon';

const MINUTES_PER_DAY = 24 * 60;
const MAX_SLIDER_MINUTE = MINUTES_PER_DAY - 1;
const SLIDER_STEP_MINUTES = 15;

export interface ObservingWindowChange {
  sceneTimestampUtc: string;
  window: ObservingWindow;
}

type ObservingWindowSheetProps = {
  clock?: () => string;
  observer: ObserverLocation;
  onChange: (change: ObservingWindowChange) => void;
  onPreview?: (sceneTimestampUtc: string) => void;
  onClose: () => void;
  sceneTimestampUtc: string;
  timeZoneId: string;
  visible: boolean;
  window: ObservingWindow;
};

const clampSliderMinute = (value: number) =>
  Math.max(0, Math.min(MAX_SLIDER_MINUTE, Math.round(value)));

const dateAccessibilityLabel = (date: LocalCivilDate) =>
  `Choose ${date.day} ${new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    timeZone: 'UTC',
  }).format(
    new Date(Date.UTC(date.year, date.month - 1, date.day)),
  )} ${date.year}`;

const sameDate = (left: LocalCivilDate, right: LocalCivilDate) =>
  left.year === right.year &&
  left.month === right.month &&
  left.day === right.day;

const calendarDates = (month: LocalCivilDate) => {
  const leadingBlankCount = new Date(
    Date.UTC(month.year, month.month - 1, 1),
  ).getUTCDay();
  const dayCount = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  return [
    ...Array.from({ length: leadingBlankCount }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => ({
      year: month.year,
      month: month.month,
      day: index + 1,
    })),
  ];
};

const localDateAtInstant = (timestampUtc: string, timeZoneId: string) => {
  const local = localCivilDateTimeAtInstant(timestampUtc, timeZoneId);
  return { year: local.year, month: local.month, day: local.day };
};

const sceneDateTimeLabel = (timestampUtc: string, timeZoneId: string) => {
  const local = localCivilDateTimeAtInstant(timestampUtc, timeZoneId);
  const day = String(local.day).padStart(2, '0');
  const month = String(local.month).padStart(2, '0');
  return `${day}/${month}/${local.year} ${formatLocalTimeInput(local)}`;
};

const TimeNavigationButton = ({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: 'conditions' | 'nextDay' | 'previousDay' | 'restore';
  onPress: () => void;
}) => (
  <Pressable
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    hitSlop={4}
    onPress={onPress}
    style={({ pressed }) => [
      styles.timeNavigationButton,
      pressed && styles.pressed,
    ]}
  >
    <AppIcon color={colors.primary} name={icon} size={22} />
  </Pressable>
);

const TimeOfDaySlider = ({
  civilDate,
  observer,
  onChooseDate,
  onCommit,
  onPreview,
  onNextDay,
  onPreviousDay,
  onReturnToNow,
  sceneTimestampUtc,
  timeZoneId,
  valueMinute,
  window,
}: {
  civilDate: LocalCivilDate;
  observer: ObserverLocation;
  onChooseDate: () => void;
  onCommit: (timestampUtc: string) => void;
  onPreview?: (timestampUtc: string) => void;
  onNextDay: () => void;
  onPreviousDay: () => void;
  onReturnToNow: () => void;
  sceneTimestampUtc: string;
  timeZoneId: string;
  valueMinute: number;
  window: ObservingWindow;
}) => {
  const [widthPixels, setWidthPixels] = useState(1);
  const [conditionsVisible, setConditionsVisible] = useState(false);
  const boundedValue = clampSliderMinute(valueMinute);
  const [dragMinute, setDragMinute] = useState<number | null>(null);
  const draftMinute = dragMinute ?? boundedValue;
  const conditionTrack = useMemo(
    () => createSkyConditionTrack({ observer, timeZoneId, window }),
    [observer, timeZoneId, window],
  );
  const darkness = useMemo(
    () => createAstronomicalDarknessSpan(observer, window),
    [observer, window],
  );
  const timestampAt = (minuteOfTrack: number) =>
    resolveNoonCenteredSliderTimestamp({
      civilDate,
      minuteOfTrack: clampSliderMinute(minuteOfTrack),
      timeZoneId,
    });
  const updateDraftFromDrag = (dragDeltaXPixels: number) => {
    const nextValue = clampSliderMinute(
      boundedValue + (dragDeltaXPixels / widthPixels) * MINUTES_PER_DAY,
    );
    setDragMinute(nextValue);
    onPreview?.(timestampAt(nextValue));
    return nextValue;
  };
  const finishDrag = (dragDeltaXPixels: number) => {
    const finalDraftMinute = updateDraftFromDrag(dragDeltaXPixels);
    setDragMinute(null);
    onCommit(timestampAt(finalDraftMinute));
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => setDragMinute(boundedValue),
        onPanResponderMove: (_, gestureState) =>
          updateDraftFromDrag(gestureState.dx),
        onPanResponderRelease: (_, gestureState) => finishDrag(gestureState.dx),
        onPanResponderTerminate: (_, gestureState) =>
          finishDrag(gestureState.dx),
      }),
    // Gesture mapping must track both the measured width and active civil day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boundedValue, civilDate, onCommit, onPreview, timeZoneId, widthPixels],
  );
  const timestampUtc = timestampAt(draftMinute);
  const percent = (draftMinute / MINUTES_PER_DAY) * 100;
  const conditionIndex = Math.min(
    conditionTrack.length - 1,
    Math.round((draftMinute / MINUTES_PER_DAY) * (conditionTrack.length - 1)),
  );
  const condition = conditionTrack[conditionIndex]!.condition;
  const moonConditions = useMemo(
    () =>
      conditionsVisible
        ? createMoonConditions({
            observer,
            timestampUtc: sceneTimestampUtc,
            timeZoneId,
            window,
          })
        : null,
    [conditionsVisible, observer, sceneTimestampUtc, timeZoneId, window],
  );

  return (
    <View style={styles.sliderField}>
      <Pressable
        accessibilityLabel="Choose date and time"
        accessibilityRole="button"
        hitSlop={4}
        onPress={onChooseDate}
        style={({ pressed }) => [
          styles.dateTimeButton,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.dateTimeContent}>
          <AppText style={styles.timeValue}>
            {sceneDateTimeLabel(timestampUtc, timeZoneId)}
          </AppText>
          <AppText style={styles.inlineCondition}>({condition})</AppText>
        </View>
      </Pressable>
      <View style={styles.timeNavigationRow} testID="time-navigation-row">
        <TimeNavigationButton
          accessibilityLabel="Previous day"
          icon="previousDay"
          onPress={onPreviousDay}
        />
        <TimeNavigationButton
          accessibilityLabel="Return to current time"
          icon="restore"
          onPress={onReturnToNow}
        />
        <TimeNavigationButton
          accessibilityLabel={`${conditionsVisible ? 'Hide' : 'Show'} shooting conditions`}
          icon="conditions"
          onPress={() => setConditionsVisible((current) => !current)}
        />
        <TimeNavigationButton
          accessibilityLabel="Next day"
          icon="nextDay"
          onPress={onNextDay}
        />
      </View>
      {conditionsVisible && moonConditions ? (
        <View style={styles.conditionsPanel}>
          <MoonPhaseIcon phaseDegrees={moonConditions.phaseDegrees} />
          <View style={styles.conditionsSummary}>
            <AppText style={styles.conditionsTitle}>
              {moonConditions.phaseName}
            </AppText>
            <AppText tone="muted">
              {moonConditions.illuminatedPercent}% illuminated
            </AppText>
          </View>
          <View style={styles.moonEvents}>
            <AppText style={styles.moonEvent} tone="muted">
              Moonrise {moonConditions.riseLocalTime ?? '—'}
            </AppText>
            <AppText style={styles.moonEvent} tone="muted">
              Moonset {moonConditions.setLocalTime ?? '—'}
            </AppText>
          </View>
        </View>
      ) : null}
      <View
        accessibilityActions={[
          { name: 'decrement', label: 'Earlier by 15 minutes' },
          { name: 'increment', label: 'Later by 15 minutes' },
        ]}
        accessibilityLabel="Time of day"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 0,
          max: MAX_SLIDER_MINUTE,
          now: draftMinute,
          text: sceneDateTimeLabel(timestampUtc, timeZoneId),
        }}
        onAccessibilityAction={(event) => {
          const delta =
            event.nativeEvent.actionName === 'increment'
              ? SLIDER_STEP_MINUTES
              : event.nativeEvent.actionName === 'decrement'
                ? -SLIDER_STEP_MINUTES
                : 0;
          onCommit(timestampAt(draftMinute + delta));
        }}
        onLayout={(event: LayoutChangeEvent) =>
          setWidthPixels(Math.max(1, event.nativeEvent.layout.width))
        }
        style={styles.sliderTouchTrack}
        {...responder.panHandlers}
      >
        <View style={styles.sliderTrack} testID="time-slider-track">
          <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
            <Defs>
              <SvgLinearGradient id="sky-condition-gradient" x1="0" x2="1">
                {conditionTrack.map((sample) => (
                  <Stop
                    key={sample.timestampUtc}
                    offset={`${sample.offsetPercent * 100}%`}
                    stopColor={sample.color}
                  />
                ))}
              </SvgLinearGradient>
            </Defs>
            <Rect
              fill="url(#sky-condition-gradient)"
              height="100%"
              rx={6}
              width="100%"
            />
          </Svg>
          <View
            style={[styles.sliderThumb, { left: `${percent}%` }]}
            testID="time-slider-thumb"
          />
        </View>
      </View>
      <DarknessMarkers
        civilDate={civilDate}
        darkness={darkness}
        onCommit={onCommit}
        timeZoneId={timeZoneId}
        window={window}
      />
    </View>
  );
};

const DarknessMarkers = ({
  civilDate,
  darkness,
  onCommit,
  timeZoneId,
  window,
}: {
  civilDate: LocalCivilDate;
  darkness: AstronomicalDarknessSpan;
  onCommit: (timestampUtc: string) => void;
  timeZoneId: string;
  window: ObservingWindow;
}) => {
  if (darkness.kind !== 'bounded') {
    return (
      <AppText style={styles.darknessStatus} tone="muted">
        {darkness.kind === 'allDay'
          ? 'Astronomical darkness all day'
          : 'No astronomical darkness'}
      </AppText>
    );
  }
  const markers = [
    { label: 'Starts', timestampUtc: darkness.startTimestampUtc },
    { label: 'Ends', timestampUtc: darkness.endTimestampUtc },
  ] as const;
  return (
    <View style={styles.darknessMarkers}>
      {markers.map((marker) => {
        const timestampUtc = clampNoonCenteredTrackEndTimestamp({
          civilDate,
          timestampUtc: marker.timestampUtc,
          timeZoneId,
          windowEndTimestampUtc: window.endTimestampUtc,
        });
        const minute = getNoonCenteredSliderMinute({
          civilDate,
          timestampUtc,
          timeZoneId,
        });
        const local = localCivilDateTimeAtInstant(timestampUtc, timeZoneId);
        const time = formatLocalTimeInput(local);
        const offsetPercent = (minute / MINUTES_PER_DAY) * 100;
        const position = { left: `${offsetPercent}%` as const };
        return (
          <Pressable
            accessibilityLabel={`Set time to darkness ${marker.label.toLowerCase()} at ${time}`}
            accessibilityRole="button"
            hitSlop={8}
            key={marker.label}
            onPress={() => onCommit(timestampUtc)}
            style={[styles.darknessMarker, position]}
          >
            <View style={styles.markerTick} />
            <AppText style={styles.darknessMarkerText}>{time}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
};

export const ObservingWindowSheet = (props: ObservingWindowSheetProps) =>
  props.visible ? <VisibleObservingWindowSheet {...props} /> : null;

const VisibleObservingWindowSheet = ({
  clock = () => new Date().toISOString(),
  observer,
  onChange,
  onPreview,
  onClose,
  sceneTimestampUtc,
  timeZoneId,
}: Omit<ObservingWindowSheetProps, 'visible'>) => {
  const initialDate = getNoonCenteredObservingDate(
    sceneTimestampUtc,
    timeZoneId,
  );
  const initialSceneDate = localDateAtInstant(sceneTimestampUtc, timeZoneId);
  const [observingDate, setObservingDate] =
    useState<LocalCivilDate>(initialDate);
  const [displayedMonth, setDisplayedMonth] = useState<LocalCivilDate>({
    ...initialSceneDate,
    day: 1,
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [localSceneTimestampUtc, setLocalSceneTimestampUtc] =
    useState(sceneTimestampUtc);
  // Incoming windows may use the legacy midnight boundary; this sheet always
  // owns the noon-centred window that corresponds to its selected date.
  const [localWindow, setLocalWindow] = useState(() =>
    createDateObservingWindow({ civilDate: initialDate, timeZoneId }),
  );
  const days = useMemo(() => calendarDates(displayedMonth), [displayedMonth]);
  const valueMinute = getNoonCenteredSliderMinute({
    civilDate: observingDate,
    timestampUtc: localSceneTimestampUtc,
    timeZoneId,
  });
  const sceneDate = localDateAtInstant(localSceneTimestampUtc, timeZoneId);
  const emitChange = (change: ObservingWindowChange) => {
    setLocalSceneTimestampUtc(change.sceneTimestampUtc);
    setLocalWindow(change.window);
    onChange(change);
  };
  const selectCivilDate = (date: LocalCivilDate) => {
    const nextObservingDate =
      valueMinute >= MINUTES_PER_DAY / 2 ? addDaysToLocalDate(date, -1) : date;
    const nextWindow = createDateObservingWindow({
      civilDate: nextObservingDate,
      timeZoneId,
    });
    const nextTimestampUtc = resolveNoonCenteredSliderTimestamp({
      civilDate: nextObservingDate,
      minuteOfTrack: valueMinute,
      timeZoneId,
    });
    setObservingDate(nextObservingDate);
    setDisplayedMonth({ ...date, day: 1 });
    setCalendarVisible(false);
    emitChange({ sceneTimestampUtc: nextTimestampUtc, window: nextWindow });
  };
  const changeCivilDay = (dayDelta: -1 | 1) =>
    selectCivilDate(addDaysToLocalDate(sceneDate, dayDelta));
  const returnToCurrentTime = () => {
    const currentTimestampUtc = clock();
    const currentObservingDate = getNoonCenteredObservingDate(
      currentTimestampUtc,
      timeZoneId,
    );
    const currentSceneDate = localDateAtInstant(
      currentTimestampUtc,
      timeZoneId,
    );
    const nextWindow = createDateObservingWindow({
      civilDate: currentObservingDate,
      timeZoneId,
    });
    setObservingDate(currentObservingDate);
    setDisplayedMonth({ ...currentSceneDate, day: 1 });
    setCalendarVisible(false);
    emitChange({ sceneTimestampUtc: currentTimestampUtc, window: nextWindow });
  };

  return (
    <ModalSheet
      closeAccessibilityLabel="Close time sheet"
      onClose={onClose}
      title="Observing window"
      visible
    >
      {calendarVisible ? (
        <View style={styles.calendar}>
          <View style={styles.calendarHeader}>
            <ActionButton
              accessibilityLabel="Previous month"
              label="‹"
              onPress={() => {
                const previousMonth = new Date(
                  Date.UTC(displayedMonth.year, displayedMonth.month - 2, 1),
                );
                setDisplayedMonth({
                  year: previousMonth.getUTCFullYear(),
                  month: previousMonth.getUTCMonth() + 1,
                  day: 1,
                });
              }}
              variant="text"
            />
            <AppText style={styles.calendarTitle}>
              {new Intl.DateTimeFormat(undefined, {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(
                new Date(
                  Date.UTC(displayedMonth.year, displayedMonth.month - 1, 1),
                ),
              )}
            </AppText>
            <ActionButton
              accessibilityLabel="Next month"
              label="›"
              onPress={() => {
                const nextMonth = new Date(
                  Date.UTC(displayedMonth.year, displayedMonth.month, 1),
                );
                setDisplayedMonth({
                  year: nextMonth.getUTCFullYear(),
                  month: nextMonth.getUTCMonth() + 1,
                  day: 1,
                });
              }}
              variant="text"
            />
          </View>
          <View style={styles.calendarGrid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
              <AppText key={`${label}-${index}`} style={styles.weekday}>
                {label}
              </AppText>
            ))}
            {days.map((date, index) =>
              date ? (
                <Pressable
                  accessibilityLabel={dateAccessibilityLabel(date)}
                  accessibilityRole="button"
                  key={`${date.year}-${date.month}-${date.day}`}
                  onPress={() => selectCivilDate(date)}
                  style={[
                    styles.calendarDay,
                    sameDate(date, sceneDate) && styles.selectedCalendarDay,
                  ]}
                >
                  <AppText>{date.day}</AppText>
                </Pressable>
              ) : (
                <View key={`blank-${index}`} style={styles.calendarDay} />
              ),
            )}
          </View>
        </View>
      ) : null}
      <TimeOfDaySlider
        civilDate={observingDate}
        observer={observer}
        onChooseDate={() => {
          if (!calendarVisible) setDisplayedMonth({ ...sceneDate, day: 1 });
          setCalendarVisible((current) => !current);
        }}
        onCommit={(nextTimestampUtc) =>
          emitChange({
            sceneTimestampUtc: nextTimestampUtc,
            window: localWindow,
          })
        }
        onPreview={onPreview}
        onNextDay={() => changeCivilDay(1)}
        onPreviousDay={() => changeCivilDay(-1)}
        onReturnToNow={returnToCurrentTime}
        sceneTimestampUtc={localSceneTimestampUtc}
        timeZoneId={timeZoneId}
        valueMinute={valueMinute}
        window={localWindow}
      />
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  calendar: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: layout.controlRadius,
    gap: 6,
    padding: 8,
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: '14.285%',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarTitle: { fontWeight: '800' },
  conditionsPanel: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: layout.controlRadius,
    flexDirection: 'row',
    gap: 6,
    padding: 8,
  },
  conditionsSummary: { flex: 1 },
  conditionsTitle: { fontWeight: '800' },
  dateTimeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  dateTimeContent: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  darknessMarker: {
    alignItems: 'flex-start',
    minWidth: layout.minimumTouchTarget,
    position: 'absolute',
    top: 0,
  },
  darknessMarkers: { height: 30, position: 'relative' },
  darknessMarkerText: {
    color: colors.mutedText,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  darknessStatus: { fontSize: 11, minHeight: 30, textAlign: 'center' },
  markerTick: { backgroundColor: colors.mutedText, height: 5, width: 1 },
  moonEvent: { fontSize: 11, textAlign: 'right' },
  moonEvents: { gap: 2 },
  inlineCondition: { color: colors.mutedText, fontSize: 12 },
  pressed: { opacity: 0.68 },
  selectedCalendarDay: { backgroundColor: colors.primaryPressed },
  sliderField: { gap: 0 },
  sliderThumb: {
    backgroundColor: colors.text,
    borderColor: colors.primary,
    borderRadius: 11,
    borderWidth: 3,
    height: 22,
    marginLeft: -11,
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -11 }],
    width: 22,
  },
  sliderTouchTrack: {
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
  },
  sliderTrack: {
    backgroundColor: colors.outline,
    borderRadius: 6,
    height: 12,
  },
  timeNavigationButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  timeNavigationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  timeValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  weekday: {
    color: colors.mutedText,
    textAlign: 'center',
    width: '14.285%',
  },
});
