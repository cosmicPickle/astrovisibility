import { fireEvent, render } from '@testing-library/react-native';
import { MaskAppearanceControls } from './MaskAppearanceControls';

jest.mock('reanimated-color-picker', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const reactNative = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onCompleteJS,
    }: {
      children: React.ReactNode;
      onCompleteJS(colors: { hex: string }): void;
    }) =>
      react.createElement(
        reactNative.View,
        null,
        children,
        react.createElement(
          reactNative.Pressable,
          {
            onPress: () => onCompleteJS({ hex: '#123456' }),
            testID: 'complete-color',
          },
          react.createElement(reactNative.Text, null, 'Complete color'),
        ),
      ),
    HueSlider: () =>
      react.createElement(reactNative.View, { testID: 'hue-slider' }),
    Panel1: () =>
      react.createElement(reactNative.View, { testID: 'color-panel' }),
    Preview: () =>
      react.createElement(reactNative.View, { testID: 'color-preview' }),
  };
});

describe('MaskAppearanceControls', () => {
  it('shows the picker only in Color mode and commits its final color', async () => {
    const onColorChange = jest.fn();
    const onModeChange = jest.fn();
    const commonProps = {
      color: '#7B8497',
      onColorChange,
      onModeChange,
      onOpacityChange: jest.fn(),
      opacityPercent: 60,
    };
    const screen = await render(
      <MaskAppearanceControls {...commonProps} mode="panorama" />,
    );

    expect(screen.queryByTestId('color-panel')).toBeNull();
    await fireEvent.press(screen.getByText('Color'));
    expect(onModeChange).toHaveBeenCalledWith('color');

    await screen.rerender(
      <MaskAppearanceControls {...commonProps} mode="color" />,
    );
    await fireEvent.press(screen.getByTestId('complete-color'));
    expect(onColorChange).toHaveBeenCalledWith('#123456');
  });
});
