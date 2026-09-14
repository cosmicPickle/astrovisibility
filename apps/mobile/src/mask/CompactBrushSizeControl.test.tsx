import { fireEvent, render } from '@testing-library/react-native';
import { CompactBrushSizeControl } from './CompactBrushSizeControl';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const SafeArea = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 400, height: 800 },
      insets: { top: 24, bottom: 24, left: 0, right: 0 },
    }}
  >
    {children}
  </SafeAreaProvider>
);

describe('compact brush size controls', () => {
  it('steps to useful sizes and opens the existing fine slider on demand', async () => {
    const change = jest.fn();
    const screen = await render(
      <CompactBrushSizeControl onChange={change} valuePixels={32} />,
      { wrapper: SafeArea },
    );
    expect(screen.queryByRole('adjustable')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Decrease brush size'));
    expect(change).toHaveBeenLastCalledWith(24);
    await fireEvent.press(screen.getByLabelText('Increase brush size'));
    expect(change).toHaveBeenLastCalledWith(48);
    await fireEvent.press(
      screen.getByLabelText('Adjust brush size, 32 pixels'),
    );
    expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(
      32,
    );
    await fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(change).toHaveBeenLastCalledWith(36);
    await fireEvent.press(screen.getByLabelText('Close brush size'));
    expect(screen.queryByRole('adjustable')).toBeNull();
  });

  it('steps around a fine slider value and disables controls at the bounds', async () => {
    const change = jest.fn();
    const screen = await render(
      <CompactBrushSizeControl onChange={change} valuePixels={35} />,
      { wrapper: SafeArea },
    );
    await fireEvent.press(screen.getByLabelText('Decrease brush size'));
    expect(change).toHaveBeenLastCalledWith(32);
    await fireEvent.press(screen.getByLabelText('Increase brush size'));
    expect(change).toHaveBeenLastCalledWith(48);
    await screen.rerender(
      <CompactBrushSizeControl onChange={change} valuePixels={8} />,
    );
    expect(
      screen.getByLabelText('Decrease brush size').props.accessibilityState
        .disabled,
    ).toBe(true);
    await screen.rerender(
      <CompactBrushSizeControl onChange={change} valuePixels={72} />,
    );
    expect(
      screen.getByLabelText('Increase brush size').props.accessibilityState
        .disabled,
    ).toBe(true);
  });
});
