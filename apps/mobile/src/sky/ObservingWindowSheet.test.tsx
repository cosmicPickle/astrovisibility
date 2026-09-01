import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PanResponder, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createDateObservingWindow } from '../astronomy/observingWindow';
import { createAstronomicalDarknessSpan } from '../astronomy/observingConditions';
import { ObservingWindowSheet } from './ObservingWindowSheet';

const window = createDateObservingWindow({
  civilDate: { year: 2026, month: 8, day: 21 },
  timeZoneId: 'Europe/Sofia',
});

beforeAll(() => {
  jest.spyOn(PanResponder, 'create').mockImplementation(
    (handlers) =>
      ({
        panHandlers: {
          onResponderGrant: handlers.onPanResponderGrant,
          onResponderMove: handlers.onPanResponderMove,
          onResponderRelease: handlers.onPanResponderRelease,
          onResponderTerminate: handlers.onPanResponderTerminate,
        },
      }) as ReturnType<typeof PanResponder.create>,
  );
});

afterAll(() => {
  jest.restoreAllMocks();
});

const observer = {
  latitudeDegreesNorth: 42.7,
  longitudeDegreesEast: 23.3,
  elevationMetersAboveMeanSeaLevel: 550,
};

const renderSheet = async ({
  clock = () => '2026-08-20T10:15:00.000Z',
  onChange = jest.fn(),
  sceneTimestampUtc = '2026-08-21T21:00:00.000Z',
  selectedWindow = window,
}: {
  clock?: () => string;
  onChange?: jest.Mock;
  sceneTimestampUtc?: string;
  selectedWindow?: typeof window;
} = {}) => ({
  onChange,
  screen: await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 24, left: 0, right: 0, bottom: 24 },
      }}
    >
      <ObservingWindowSheet
        clock={clock}
        observer={observer}
        onChange={onChange}
        onClose={jest.fn()}
        sceneTimestampUtc={sceneTimestampUtc}
        timeZoneId="Europe/Sofia"
        visible
        window={selectedWindow}
      />
    </SafeAreaProvider>,
  ),
});

describe('ObservingWindowSheet', () => {
  it('unifies the date/time control with centred day navigation and condition controls', async () => {
    const { screen } = await renderSheet();

    expect(screen.getByLabelText('Choose date and time')).toBeTruthy();
    expect(screen.getByLabelText('Time of day')).toBeTruthy();
    expect(screen.getByLabelText('Previous day')).toBeTruthy();
    expect(screen.getByLabelText('Return to current time')).toBeTruthy();
    expect(screen.getByLabelText('Next day')).toBeTruthy();
    expect(screen.getByLabelText('Show shooting conditions')).toBeTruthy();
    expect(screen.queryByText('DATE')).toBeNull();
    expect(screen.queryByText('TIME OF DAY')).toBeNull();
    expect(screen.queryByText('Now')).toBeNull();
    expect(screen.queryByText('Tonight')).toBeNull();
    expect(screen.queryByText('Custom interval')).toBeNull();
    expect(screen.queryByLabelText('Start date')).toBeNull();
    expect(screen.queryByText(/Browse one 24-hour sky day/)).toBeNull();
    expect(screen.queryByText('Trajectory period')).toBeNull();
    expect(screen.queryByText('Fixed at 24 elapsed hours.')).toBeNull();
  });

  it('moves smoothly during a drag and updates the atlas only when released', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet({ onChange });
    const slider = screen.getByLabelText('Time of day');

    await act(async () => {
      slider.props.onLayout({ nativeEvent: { layout: { width: 240 } } });
    });
    const measuredSlider = screen.getByLabelText('Time of day');
    await act(async () => {
      measuredSlider.props.onResponderGrant({}, { dx: 0 });
      measuredSlider.props.onResponderMove({}, { dx: 60 });
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/06:00/)).toBeTruthy();

    await act(async () => {
      screen
        .getByLabelText('Time of day')
        .props.onResponderRelease({}, { dx: 60 });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-22T03:00:00.000Z',
      window,
    });
  });

  it('does not jump to midnight when a drag reverses direction', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet({ onChange });
    const slider = screen.getByLabelText('Time of day');

    await act(async () => {
      slider.props.onLayout({ nativeEvent: { layout: { width: 240 } } });
    });
    await act(async () => {
      const measuredSlider = screen.getByLabelText('Time of day');
      measuredSlider.props.onResponderGrant({}, { dx: 0 });
      measuredSlider.props.onResponderMove({}, { dx: 30 });
      measuredSlider.props.onResponderMove({}, { dx: -10 });
    });

    expect(screen.getByText(/23:00/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('centres the slider thumb vertically on its track', async () => {
    const { screen } = await renderSheet();
    const style = StyleSheet.flatten(
      screen.getByTestId('time-slider-thumb').props.style,
    );

    expect(style.top).toBe('50%');
    expect(style.transform).toEqual([{ translateY: -11 }]);
    expect(
      StyleSheet.flatten(screen.getByTestId('time-slider-track').props.style)
        .height,
    ).toBe(12);
  });

  it('supports accessible 15-minute steps without a drag', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet({ onChange });

    fireEvent(screen.getByLabelText('Time of day'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-21T21:15:00.000Z',
      window,
    });
  });

  it('changes the date through a calendar while preserving time of day', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet({ onChange });

    fireEvent.press(screen.getByLabelText('Choose date and time'));
    await waitFor(() => screen.getByLabelText('Choose 23 August 2026'));
    fireEvent.press(screen.getByLabelText('Choose 23 August 2026'));

    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-22T21:00:00.000Z',
      window: expect.objectContaining({
        kind: 'day',
        startTimestampUtc: '2026-08-22T09:00:00.000Z',
        endTimestampUtc: '2026-08-23T09:00:00.000Z',
      }),
    });
  });

  it('moves to the previous civil day at the same local time', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet({ onChange });

    fireEvent.press(screen.getByLabelText('Previous day'));

    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-20T21:00:00.000Z',
      window: expect.objectContaining({
        startTimestampUtc: '2026-08-20T09:00:00.000Z',
        endTimestampUtc: '2026-08-21T09:00:00.000Z',
      }),
    });
  });

  it('moves to the next civil day at the same local time', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet({ onChange });

    fireEvent.press(screen.getByLabelText('Next day'));

    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-22T21:00:00.000Z',
      window: expect.objectContaining({
        startTimestampUtc: '2026-08-22T09:00:00.000Z',
        endTimestampUtc: '2026-08-23T09:00:00.000Z',
      }),
    });
  });

  it('reads the system clock when rollback is pressed and selects its owning observing date', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet({ onChange });

    fireEvent.press(screen.getByLabelText('Return to current time'));

    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-20T10:15:00.000Z',
      window: expect.objectContaining({
        kind: 'day',
        startTimestampUtc: '2026-08-20T09:00:00.000Z',
        endTimestampUtc: '2026-08-21T09:00:00.000Z',
      }),
    });
  });

  it('keeps the reset icon available while already at the current time', async () => {
    const now = '2026-08-21T21:00:00.000Z';
    const { screen } = await renderSheet({ clock: () => now });

    expect(screen.getByLabelText('Return to current time')).toBeTruthy();
  });

  it('positions clickable astronomical darkness bounds under the track', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet({ onChange });
    const darkness = createAstronomicalDarknessSpan(observer, window);
    if (darkness.kind !== 'bounded') throw new Error('Expected darkness');

    fireEvent.press(screen.getByLabelText(/Set time to darkness start/));

    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: darkness.startTimestampUtc,
      window,
    });
    const endMarker = screen.getByLabelText(/Set time to darkness end/);
    expect(endMarker).toBeTruthy();
    expect(screen.queryByText(/^Starts /)).toBeNull();
    expect(screen.queryByText(/^Ends /)).toBeNull();
    const endMarkerStyle = StyleSheet.flatten(endMarker.props.style);
    expect(endMarkerStyle.left).toBeDefined();
    expect(endMarkerStyle.right).toBeUndefined();
  });

  it('normalizes a pre-existing midnight day window to the noon-centred day', async () => {
    const legacyWindow = {
      kind: 'day' as const,
      startTimestampUtc: '2026-08-30T21:00:00.000Z',
      endTimestampUtc: '2026-08-31T21:00:00.000Z',
      note: null,
      warnings: [],
    };

    const { screen } = await renderSheet({
      sceneTimestampUtc: '2026-09-01T07:00:00.000Z',
      selectedWindow: legacyWindow,
    });

    expect(screen.getByLabelText(/Set time to darkness start/)).toBeTruthy();
    expect(screen.getByLabelText(/Set time to darkness end/)).toBeTruthy();
  });

  it('reveals current moon phase, fullness, rise, and set conditions', async () => {
    const selectedWindow = createDateObservingWindow({
      civilDate: { year: 2026, month: 5, day: 1 },
      timeZoneId: 'Europe/Sofia',
    });
    const { screen } = await renderSheet({
      sceneTimestampUtc: '2026-05-01T21:00:00.000Z',
      selectedWindow,
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Show shooting conditions'));
    });

    await waitFor(() => screen.getByText('Full Moon'));
    expect(screen.getByText(/% illuminated/)).toBeTruthy();
    expect(screen.getByText(/Moonrise/)).toBeTruthy();
    expect(screen.getByText(/Moonset/)).toBeTruthy();
    expect(screen.getByLabelText('Hide shooting conditions')).toBeTruthy();
  });
});
