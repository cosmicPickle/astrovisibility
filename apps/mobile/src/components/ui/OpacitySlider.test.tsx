import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { OpacitySlider } from './OpacitySlider';

describe('OpacitySlider', () => {
  it('previews during a drag and commits once on release with a reliable zero snap', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <OpacitySlider label="Mask opacity" onChange={onChange} value={60} />,
    );
    const slider = screen.getByLabelText('Mask opacity');
    await act(async () =>
      fireEvent(slider, 'layout', {
        nativeEvent: { layout: { height: 44, width: 100, x: 0, y: 0 } },
      }),
    );
    await act(async () =>
      fireEvent(slider, 'responderGrant', {
        nativeEvent: { locationX: 50 },
      }),
    );
    await act(async () =>
      fireEvent(slider, 'responderMove', {
        nativeEvent: { locationX: 1 },
      }),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('0%')).toBeTruthy();

    await act(async () =>
      fireEvent(slider, 'responderRelease', {
        nativeEvent: { locationX: 1 },
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('commits the preview when Android terminates the gesture', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <OpacitySlider label="Mask opacity" onChange={onChange} value={60} />,
    );
    const slider = screen.getByLabelText('Mask opacity');
    await act(async () =>
      fireEvent(slider, 'layout', {
        nativeEvent: { layout: { height: 44, width: 100, x: 0, y: 0 } },
      }),
    );
    await act(async () =>
      fireEvent(slider, 'responderMove', {
        nativeEvent: { locationX: 42 },
      }),
    );
    await act(async () => fireEvent(slider, 'responderTerminate'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('exposes bounded adjustable accessibility actions', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <OpacitySlider label="Panorama opacity" onChange={onChange} value={55} />,
    );
    const slider = screen.getByLabelText('Panorama opacity');
    expect(slider.props.onStartShouldSetResponder()).toBe(true);
    expect(slider.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 55,
      text: '55 percent',
    });
    await act(async () =>
      fireEvent(slider, 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      }),
    );
    await act(async () =>
      fireEvent(slider, 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      }),
    );
    expect(onChange).toHaveBeenNthCalledWith(1, 60);
    expect(onChange).toHaveBeenNthCalledWith(2, 50);
  });

  it('centres its thumb vertically on the track', async () => {
    const screen = await render(
      <OpacitySlider label="Mask opacity" onChange={jest.fn()} value={60} />,
    );
    const style = StyleSheet.flatten(
      screen.getByTestId('opacity-slider-thumb').props.style,
    );

    expect(style.top).toBe('50%');
    expect(style.transform).toEqual([{ translateY: -9 }]);
    expect(screen.getByTestId('opacity-slider-track').props.pointerEvents).toBe(
      'none',
    );
  });
});
