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
  onClose: () => void;
  sceneTimestampUtc: string;
  timeZoneId: string;
  visible: boolean;
  window: ObservingWindow;
};

const clampSliderMinute = (value: number) =>
  Math.max(0, Math.min(MAX_SLIDER_MINUTE, Math.round(value)));

const dateLabel = (date: LocalCivilDate) =>
  new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));

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

const sceneTimeLabel = (timestampUtc: string, timeZoneId: string) => {
  const local = localCivilDateTimeAtInstant(timestampUtc, timeZoneId);
  const abbreviatedDate = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(local.year, local.month - 1, local.day)));
  return `${abbreviatedDate} · ${formatLocalTimeInput(local)}`;
};

const TimeOfDaySlider = ({
  civilDate,
  observer,
  onCommit,
  onReturnToNow,
  showReturnToNow,
  timeZoneId,
  valueMinute,
  window,
}: {
  civilDate: LocalCivilDate;
  observer: ObserverLocation;
  onCommit: (timestampUtc: string) => void;
  onReturnToNow: () => void;
  showReturnToNow: boolean;
  timeZoneId: string;
  valueMinute: number;
  window: ObservingWindow;
}) => {
  const [widthPixels, setWidthPixels] = useState(1);
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
    [boundedValue, civilDate, onCommit, timeZoneId, widthPixels],
  );
  const timestampUtc = timestampAt(draftMinute);
  const percent = (draftMinute / MINUTES_PER_DAY) * 100;
  const conditionIndex = Math.min(
    conditionTrack.length - 1,
    Math.round((draftMinute / MINUTES_PER_DAY) * (conditionTrack.length - 1)),
  );
  const condition = conditionTrack[conditionIndex]!.condition;

  return (
    <View style={styles.sliderField}>
      <View style={styles.labelRow}>
        <AppText tone="label">Time of day</AppText>
        <View style={styles.timeHeading}>
          <AppText style={styles.timeValue}>
            {sceneTimeLabel(timestampUtc, timeZoneId)}
          </AppText>
          <AppText style={styles.conditionText}>({condition})</AppText>
          {showReturnToNow ? (
            <Pressable
              accessibilityLabel="Return to current time"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onReturnToNow}
              style={({ pressed }) => [
                styles.inlineIconButton,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon color={colors.primary} name="restore" size={19} />
            </Pressable>
          ) : null}
        </View>
      </View>
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
          text: sceneTimeLabel(timestampUtc, timeZoneId),
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
        const position =
          minute >= MINUTES_PER_DAY / 2
            ? { right: `${100 - offsetPercent}%` as const }
            : { left: `${offsetPercent}%` as const };
        return (
          <Pressable
            accessibilityLabel={`Set time to darkness ${marker.label.toLowerCase()} at ${time}`}
            accessibilityRole="button"
            hitSlop={8}
            key={marker.label}
            onPress={() => onCommit(timestampUtc)}
            style={[
              styles.darknessMarker,
              position,
              minute >= MINUTES_PER_DAY / 2 && styles.darknessMarkerRight,
            ]}
          >
            <View style={styles.markerTick} />
            <AppText style={styles.darknessMarkerText}>
              {marker.label} {time}
            </AppText>
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
  onClose,
  sceneTimestampUtc,
  timeZoneId,
}: Omit<ObservingWindowSheetProps, 'visible'>) => {
  const initialDate = getNoonCenteredObservingDate(
    sceneTimestampUtc,
    timeZoneId,
  );
  const [selectedDate, setSelectedDate] = useState<LocalCivilDate>(initialDate);
  const [displayedMonth, setDisplayedMonth] = useState<LocalCivilDate>({
    ...initialDate,
    day: 1,
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [conditionsVisible, setConditionsVisible] = useState(false);
  const [localSceneTimestampUtc, setLocalSceneTimestampUtc] =
    useState(sceneTimestampUtc);
  // Incoming windows may use the legacy midnight boundary; this sheet always
  // owns the noon-centred window that corresponds to its selected date.
  const [localWindow, setLocalWindow] = useState(() =>
    createDateObservingWindow({ civilDate: initialDate, timeZoneId }),
  );
  const days = useMemo(() => calendarDates(displayedMonth), [displayedMonth]);
  const valueMinute = getNoonCenteredSliderMinute({
    civilDate: selectedDate,
    timestampUtc: localSceneTimestampUtc,
    timeZoneId,
  });
  const moonConditions = useMemo(
    () =>
      conditionsVisible
        ? createMoonConditions({
            observer,
            timestampUtc: localSceneTimestampUtc,
            timeZoneId,
            window: localWindow,
          })
        : null,
    [
      conditionsVisible,
      localSceneTimestampUtc,
      localWindow,
      observer,
      timeZoneId,
    ],
  );
  const nowTimestampUtc = clock();
  const showReturnToNow =
    Math.abs(
      Date.parse(localSceneTimestampUtc) - Date.parse(nowTimestampUtc),
    ) >= 60_000;
  const emitChange = (change: ObservingWindowChange) => {
    setLocalSceneTimestampUtc(change.sceneTimestampUtc);
    setLocalWindow(change.window);
    onChange(change);
  };
  const selectDate = (date: LocalCivilDate) => {
    const nextWindow = createDateObservingWindow({
      civilDate: date,
      timeZoneId,
    });
    const nextTimestampUtc = resolveNoonCenteredSliderTimestamp({
      civilDate: date,
      minuteOfTrack: valueMinute,
      timeZoneId,
    });
    setSelectedDate(date);
    setCalendarVisible(false);
    emitChange({ sceneTimestampUtc: nextTimestampUtc, window: nextWindow });
  };
  const returnToCurrentTime = () => {
    const currentTimestampUtc = clock();
    const date = getNoonCenteredObservingDate(currentTimestampUtc, timeZoneId);
    const nextWindow = createDateObservingWindow({
      civilDate: date,
      timeZoneId,
    });
    setSelectedDate(date);
    setDisplayedMonth({ ...date, day: 1 });
    emitChange({ sceneTimestampUtc: currentTimestampUtc, window: nextWindow });
  };

  return (
    <ModalSheet
      closeAccessibilityLabel="Close time sheet"
      onClose={onClose}
      title="Observing window"
      visible
    >
      <View style={styles.dateRow}>
        <Pressable
          accessibilityLabel="Choose observing date"
          accessibilityRole="button"
          onPress={() => setCalendarVisible((current) => !current)}
          style={styles.dateButton}
        >
          <AppText tone="label">Date</AppText>
          <AppText style={styles.dateValue}>{dateLabel(selectedDate)}</AppText>
        </Pressable>
        <Pressable
          accessibilityLabel={`${conditionsVisible ? 'Hide' : 'Show'} shooting conditions`}
          accessibilityRole="button"
          onPress={() => {
            setConditionsVisible((current) => !current);
            setCalendarVisible(false);
          }}
          style={({ pressed }) => [
            styles.conditionsButton,
            conditionsVisible && styles.conditionsButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <AppIcon name="shootingConditions" size={24} />
        </Pressable>
      </View>
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
                  onPress={() => selectDate(date)}
                  style={[
                    styles.calendarDay,
                    sameDate(date, selectedDate) && styles.selectedCalendarDay,
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
      <TimeOfDaySlider
        civilDate={selectedDate}
        observer={observer}
        onCommit={(nextTimestampUtc) =>
          emitChange({
            sceneTimestampUtc: nextTimestampUtc,
            window: localWindow,
          })
        }
        onReturnToNow={returnToCurrentTime}
        showReturnToNow={showReturnToNow}
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
  conditionText: { color: colors.mutedText, fontSize: 11 },
  conditionsButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  conditionsButtonActive: { borderColor: colors.primary },
  conditionsPanel: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: layout.controlRadius,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  conditionsSummary: { flex: 1 },
  conditionsTitle: { fontWeight: '800' },
  dateButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateValue: { fontSize: 16, fontWeight: '800' },
  darknessMarker: {
    alignItems: 'flex-start',
    position: 'absolute',
    top: 0,
  },
  darknessMarkerRight: {
    alignItems: 'flex-end',
    transform: [{ translateX: -1 }],
  },
  darknessMarkers: { height: 30, position: 'relative' },
  darknessMarkerText: {
    color: colors.mutedText,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  darknessStatus: { fontSize: 11, minHeight: 30, textAlign: 'center' },
  inlineIconButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    marginLeft: 2,
    width: 28,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  markerTick: { backgroundColor: colors.mutedText, height: 5, width: 1 },
  moonEvent: { fontSize: 11, textAlign: 'right' },
  moonEvents: { gap: 2 },
  pressed: { opacity: 0.68 },
  selectedCalendarDay: { backgroundColor: colors.primaryPressed },
  sliderField: { gap: 3 },
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
  timeHeading: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  timeValue: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  weekday: {
    color: colors.mutedText,
    textAlign: 'center',
    width: '14.285%',
  },
});
