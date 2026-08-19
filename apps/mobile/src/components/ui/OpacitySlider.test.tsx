import { act, fireEvent, render } from '@testing-library/react-native';

import { OpacitySlider } from './OpacitySlider';

describe('OpacitySlider', () => {
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
});
