import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('publishes only the last value after the delay', async () => {
    const hook = await renderHook(
      ({ value }: Readonly<{ value: string }>) => useDebouncedValue(value, 250),
      { initialProps: { value: '' } },
    );

    await hook.rerender({ value: 'And' });
    await act(async () => jest.advanceTimersByTime(200));
    expect(hook.result.current).toBe('');

    await hook.rerender({ value: 'Andromeda' });
    await act(async () => jest.advanceTimersByTime(249));
    expect(hook.result.current).toBe('');
    await act(async () => jest.advanceTimersByTime(1));
    expect(hook.result.current).toBe('Andromeda');
    await hook.unmount();
  });
});
