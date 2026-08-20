import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PanResponder, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createDateObservingWindow } from '../astronomy/observingWindow';
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

const renderSheet = async (onChange = jest.fn()) => ({
  onChange,
  screen: await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 24, left: 0, right: 0, bottom: 24 },
      }}
    >
      <ObservingWindowSheet
        clock={() => '2026-08-20T10:15:00.000Z'}
        observer={{
          latitudeDegreesNorth: 42.7,
          longitudeDegreesEast: 23.3,
          elevationMetersAboveMeanSeaLevel: 550,
        }}
        onChange={onChange}
        onClose={jest.fn()}
        sceneTimestampUtc="2026-08-21T09:00:00.000Z"
        timeZoneId="Europe/Sofia"
        visible
        window={window}
      />
    </SafeAreaProvider>,
  ),
});

describe('ObservingWindowSheet', () => {
  it('offers one selected day, a live time slider, Now and Tonight without interval modes', async () => {
    const { screen } = await renderSheet();

    expect(screen.getByLabelText('Choose observing date')).toBeTruthy();
    expect(screen.getByLabelText('Time of day')).toBeTruthy();
    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByText('Tonight')).toBeTruthy();
    expect(screen.queryByText('Custom interval')).toBeNull();
    expect(screen.queryByLabelText('Start date')).toBeNull();
    expect(screen.queryByText(/Browse one 24-hour sky day/)).toBeNull();
    expect(screen.queryByText('Trajectory period')).toBeNull();
    expect(screen.queryByText('Fixed at 24 elapsed hours.')).toBeNull();
  });

  it('moves smoothly during a drag and updates the atlas only when released', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet(onChange);
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
    expect(screen.getByText('18:00')).toBeTruthy();

    await act(async () => {
      screen
        .getByLabelText('Time of day')
        .props.onResponderRelease({}, { dx: 60 });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-21T15:00:00.000Z',
      window,
    });
  });

  it('does not jump to midnight when a drag reverses direction', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet(onChange);
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

    expect(screen.getByText('11:00')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('centres the slider thumb vertically on its track', async () => {
    const { screen } = await renderSheet();
    const style = StyleSheet.flatten(
      screen.getByTestId('time-slider-thumb').props.style,
    );

    expect(style.top).toBe('50%');
    expect(style.transform).toEqual([{ translateY: -11 }]);
  });

  it('supports accessible 15-minute steps without a drag', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet(onChange);

    fireEvent(screen.getByLabelText('Time of day'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-21T09:15:00.000Z',
      window,
    });
  });

  it('changes the date through a calendar while preserving time of day', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet(onChange);

    fireEvent.press(screen.getByLabelText('Choose observing date'));
    await waitFor(() => screen.getByLabelText('Choose 22 August 2026'));
    fireEvent.press(screen.getByLabelText('Choose 22 August 2026'));

    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-22T09:00:00.000Z',
      window: expect.objectContaining({
        kind: 'day',
        startTimestampUtc: '2026-08-21T21:00:00.000Z',
        endTimestampUtc: '2026-08-22T21:00:00.000Z',
      }),
    });
  });

  it('reads the system clock when Now is pressed rather than caching sheet-open time', async () => {
    const onChange = jest.fn();
    const { screen } = await renderSheet(onChange);

    fireEvent.press(screen.getByText('Now'));

    expect(onChange).toHaveBeenLastCalledWith({
      sceneTimestampUtc: '2026-08-20T10:15:00.000Z',
      window: expect.objectContaining({
        kind: 'day',
        startTimestampUtc: '2026-08-19T21:00:00.000Z',
        endTimestampUtc: '2026-08-20T21:00:00.000Z',
      }),
    });
  });
});
