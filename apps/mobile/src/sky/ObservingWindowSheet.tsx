import { useMemo, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import type { ObserverLocation } from '../astronomy/horizontalCoordinates';
import {
  localCivilDateTimeAtInstant,
  type LocalCivilDate,
  type ObservingWindow,
} from '../astronomy/localCivilTime';
import {
  createDateObservingWindow,
  createDefaultObservingContext,
} from '../astronomy/observingWindow';
import { formatLocalTimeInput } from '../astronomy/observingWindowPresentation';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { colors, layout } from '../theme/tokens';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SLIDER_STEP_MILLISECONDS = 15 * 60 * 1000;

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

const clampDayOffset = (value: number) =>
  Math.max(0, Math.min(MILLISECONDS_PER_DAY, value));

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

const TimeOfDaySlider = ({
  onCommit,
  timeZoneId,
  valueMilliseconds,
  windowStartTimestampUtc,
}: {
  onCommit: (timestampUtc: string) => void;
  timeZoneId: string;
  valueMilliseconds: number;
  windowStartTimestampUtc: string;
}) => {
  const [widthPixels, setWidthPixels] = useState(1);
  const boundedValue = clampDayOffset(valueMilliseconds);
  const [dragValueMilliseconds, setDragValueMilliseconds] = useState<
    number | null
  >(null);
  const draftValueMilliseconds = dragValueMilliseconds ?? boundedValue;
  const timestampAt = (offsetMilliseconds: number) =>
    new Date(
      Date.parse(windowStartTimestampUtc) + clampDayOffset(offsetMilliseconds),
    ).toISOString();
  const updateDraftFromDrag = (dragDeltaXPixels: number) => {
    const nextValue = clampDayOffset(
      boundedValue + (dragDeltaXPixels / widthPixels) * MILLISECONDS_PER_DAY,
    );
    setDragValueMilliseconds(nextValue);
    return nextValue;
  };
  const finishDrag = (dragDeltaXPixels: number) => {
    const finalDraftValue = updateDraftFromDrag(dragDeltaXPixels);
    const roundedValue = clampDayOffset(
      Math.round(finalDraftValue / 60_000) * 60_000,
    );
    setDragValueMilliseconds(null);
    onCommit(timestampAt(roundedValue));
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => setDragValueMilliseconds(boundedValue),
        onPanResponderMove: (_, gestureState) =>
          updateDraftFromDrag(gestureState.dx),
        onPanResponderRelease: (_, gestureState) => finishDrag(gestureState.dx),
        onPanResponderTerminate: (_, gestureState) =>
          finishDrag(gestureState.dx),
      }),
    // Gesture mapping must track both the measured width and active day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boundedValue, onCommit, widthPixels, windowStartTimestampUtc],
  );
  const localTime = localCivilDateTimeAtInstant(
    timestampAt(draftValueMilliseconds),
    timeZoneId,
  );
  const percent = (draftValueMilliseconds / MILLISECONDS_PER_DAY) * 100;
  return (
    <View style={styles.sliderField}>
      <View style={styles.labelRow}>
        <AppText tone="label">Time of day</AppText>
        <AppText style={styles.timeValue}>
          {formatLocalTimeInput(localTime)}
        </AppText>
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
          max: 24 * 60,
          now: Math.round(draftValueMilliseconds / 60_000),
          text: formatLocalTimeInput(localTime),
        }}
        onAccessibilityAction={(event) => {
          const delta =
            event.nativeEvent.actionName === 'increment'
              ? SLIDER_STEP_MILLISECONDS
              : event.nativeEvent.actionName === 'decrement'
                ? -SLIDER_STEP_MILLISECONDS
                : 0;
          onCommit(timestampAt(draftValueMilliseconds + delta));
        }}
        onLayout={(event: LayoutChangeEvent) =>
          setWidthPixels(Math.max(1, event.nativeEvent.layout.width))
        }
        style={styles.sliderTouchTrack}
        {...responder.panHandlers}
      >
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${percent}%` }]} />
          <View
            style={[styles.sliderThumb, { left: `${percent}%` }]}
            testID="time-slider-thumb"
          />
        </View>
      </View>
      <View style={styles.sliderEnds}>
        <AppText tone="muted">00:00</AppText>
        <AppText tone="muted">24:00</AppText>
      </View>
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
  window,
}: Omit<ObservingWindowSheetProps, 'visible'>) => {
  const initialDate = localCivilDateTimeAtInstant(
    sceneTimestampUtc,
    timeZoneId,
  );
  const [selectedDate, setSelectedDate] = useState<LocalCivilDate>(initialDate);
  const [displayedMonth, setDisplayedMonth] = useState<LocalCivilDate>({
    ...initialDate,
    day: 1,
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [localSceneTimestampUtc, setLocalSceneTimestampUtc] =
    useState(sceneTimestampUtc);
  const [localWindow, setLocalWindow] = useState(window);
  const days = useMemo(() => calendarDates(displayedMonth), [displayedMonth]);
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
    const currentOffset = clampDayOffset(
      Date.parse(localSceneTimestampUtc) -
        Date.parse(localWindow.startTimestampUtc),
    );
    const nextTimestampUtc = new Date(
      Date.parse(nextWindow.startTimestampUtc) + currentOffset,
    ).toISOString();
    setSelectedDate(date);
    setCalendarVisible(false);
    emitChange({ sceneTimestampUtc: nextTimestampUtc, window: nextWindow });
  };
  const applyClockInstant = (mode: 'now' | 'tonight') => {
    const nowTimestampUtc = clock();
    const sceneTimestamp =
      mode === 'now'
        ? nowTimestampUtc
        : createDefaultObservingContext({
            nowTimestampUtc,
            observer,
            timeZoneId,
          }).sceneTimestampUtc;
    const date = localCivilDateTimeAtInstant(sceneTimestamp, timeZoneId);
    const nextWindow = createDateObservingWindow({
      civilDate: date,
      timeZoneId,
    });
    setSelectedDate(date);
    setDisplayedMonth({ ...date, day: 1 });
    emitChange({ sceneTimestampUtc: sceneTimestamp, window: nextWindow });
  };

  return (
    <ModalSheet
      closeAccessibilityLabel="Close time sheet"
      onClose={onClose}
      title="Observing window"
      visible
    >
      <Pressable
        accessibilityLabel="Choose observing date"
        accessibilityRole="button"
        onPress={() => setCalendarVisible((current) => !current)}
        style={styles.dateButton}
      >
        <AppText tone="label">Date</AppText>
        <AppText style={styles.dateValue}>{dateLabel(selectedDate)}</AppText>
      </Pressable>
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
      <TimeOfDaySlider
        onCommit={(nextTimestampUtc) =>
          emitChange({
            sceneTimestampUtc: nextTimestampUtc,
            window: localWindow,
          })
        }
        timeZoneId={timeZoneId}
        valueMilliseconds={
          Date.parse(localSceneTimestampUtc) -
          Date.parse(localWindow.startTimestampUtc)
        }
        windowStartTimestampUtc={localWindow.startTimestampUtc}
      />
      <View style={styles.quickActions}>
        <ActionButton
          label="Now"
          onPress={() => applyClockInstant('now')}
          style={styles.quickButton}
          variant="secondary"
        />
        <ActionButton
          label="Tonight"
          onPress={() => applyClockInstant('tonight')}
          style={styles.quickButton}
          variant="secondary"
        />
      </View>
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
  dateButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    gap: 3,
    minHeight: layout.minimumTouchTarget,
    padding: 12,
  },
  dateValue: { fontSize: 18, fontWeight: '800' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickActions: { flexDirection: 'row', gap: 8 },
  quickButton: { flex: 1 },
  selectedCalendarDay: { backgroundColor: colors.primaryPressed },
  sliderEnds: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderField: { gap: 3 },
  sliderFill: {
    backgroundColor: colors.primary,
    borderRadius: 3,
    height: 6,
  },
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
    borderRadius: 3,
    height: 6,
  },
  timeValue: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  weekday: {
    color: colors.mutedText,
    textAlign: 'center',
    width: '14.285%',
  },
});
