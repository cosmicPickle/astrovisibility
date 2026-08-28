import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BrushSizeControl } from './BrushSizeControl';

describe('BrushSizeControl', () => {
  it('exposes one bounded adjustable brush-size control', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <BrushSizeControl onChange={onChange} valuePixels={32} />,
    );
    const slider = screen.getByLabelText('Brush size');

    expect(slider.props.accessibilityValue).toEqual({
      min: 8,
      max: 72,
      now: 32,
      text: '32 pixels',
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

    expect(onChange).toHaveBeenNthCalledWith(1, 36);
    expect(onChange).toHaveBeenNthCalledWith(2, 28);
  });

  it('centres its thumb vertically on the track', async () => {
    const screen = await render(
      <BrushSizeControl onChange={jest.fn()} valuePixels={32} />,
    );
    const style = StyleSheet.flatten(
      screen.getByTestId('brush-size-slider-thumb').props.style,
    );

    expect(style.top).toBe('50%');
    expect(style.transform).toEqual([{ translateY: -9 }]);
  });
});
