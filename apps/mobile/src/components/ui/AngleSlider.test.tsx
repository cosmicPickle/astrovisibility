import { act, fireEvent, render } from '@testing-library/react-native';

import { AngleSlider } from './AngleSlider';

describe('AngleSlider', () => {
  it('previews during a drag and commits the orientation only on release', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <AngleSlider label="Orientation" onChange={onChange} value={0} />,
    );
    const slider = screen.getByLabelText('Orientation');
    await act(async () =>
      fireEvent(slider, 'layout', {
        nativeEvent: { layout: { height: 44, width: 180, x: 0, y: 0 } },
      }),
    );
    await act(async () =>
      fireEvent(slider, 'responderMove', {
        nativeEvent: { locationX: 90 },
      }),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('90°')).toBeTruthy();

    await act(async () =>
      fireEvent(slider, 'responderRelease', {
        nativeEvent: { locationX: 90 },
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(90);
  });

  it('exposes bounded five-degree accessibility actions', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <AngleSlider label="Orientation" onChange={onChange} value={175} />,
    );
    const slider = screen.getByLabelText('Orientation');
    await act(async () =>
      fireEvent(slider, 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      }),
    );
    expect(onChange).toHaveBeenCalledWith(180);
    expect(slider.props.accessibilityValue).toEqual({
      min: 0,
      max: 180,
      now: 175,
      text: '175 degrees',
    });
  });
});
