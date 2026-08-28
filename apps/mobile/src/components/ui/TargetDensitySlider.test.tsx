import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { TargetDensitySlider } from './TargetDensitySlider';

describe('TargetDensitySlider', () => {
  it('previews during a drag and commits the target floor only on release', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <TargetDensitySlider onChange={onChange} value={100} />,
    );
    const slider = screen.getByLabelText('Minimum atlas targets');
    await act(async () =>
      fireEvent(slider, 'layout', {
        nativeEvent: { layout: { height: 44, width: 190, x: 0, y: 0 } },
      }),
    );
    await act(async () =>
      fireEvent(slider, 'responderMove', {
        nativeEvent: { locationX: 190 },
      }),
    );

    expect(screen.getByText('200')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    await act(async () =>
      fireEvent(slider, 'responderRelease', {
        nativeEvent: { locationX: 190 },
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(200);
  });

  it('uses bounded ten-target accessibility steps', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <TargetDensitySlider onChange={onChange} value={100} />,
    );
    const slider = screen.getByLabelText('Minimum atlas targets');

    expect(slider.props.accessibilityValue).toEqual({
      min: 10,
      max: 200,
      now: 100,
      text: '100 targets',
    });
    await act(async () =>
      fireEvent(slider, 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      }),
    );
    expect(onChange).toHaveBeenCalledWith(110);
  });

  it('centres its thumb vertically on the track', async () => {
    const screen = await render(
      <TargetDensitySlider onChange={jest.fn()} value={100} />,
    );
    const style = StyleSheet.flatten(
      screen.getByTestId('target-density-slider-thumb').props.style,
    );

    expect(style.top).toBe('50%');
    expect(style.transform).toEqual([{ translateY: -9 }]);
    expect(
      screen.getByTestId('target-density-slider-track').props.pointerEvents,
    ).toBe('none');
  });
});
