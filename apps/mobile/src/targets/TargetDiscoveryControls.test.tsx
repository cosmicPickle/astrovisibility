import { fireEvent, render } from '@testing-library/react-native';
import { TargetDiscoveryControls } from './TargetDiscoveryControls';
import {
  useTargetDiscoveryState,
  resetTargetDiscoveryStateForTests,
  getTargetDiscoverySnapshot,
} from './targetDiscoveryState';

function Controls({ hasEquipment = true }: { hasEquipment?: boolean }) {
  const discovery = useTargetDiscoveryState('fixture');
  return (
    <TargetDiscoveryControls
      discovery={discovery}
      hasEquipment={hasEquipment}
    />
  );
}

beforeEach(resetTargetDiscoveryStateForTests);

it('starts collapsed, shares valid limits, shows invalid edits, and selects exactly one order', async () => {
  const screen = await render(<Controls />);
  expect(screen.queryByLabelText('Min size in pixels')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Longest Visible' }).props
      .accessibilityState.selected,
  ).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Advanced' }));
  await fireEvent.changeText(
    screen.getByLabelText('Min size in pixels'),
    '100',
  );
  await fireEvent.changeText(screen.getByLabelText('Max size in pixels'), '90');
  expect(screen.getByText('Max size must be at least Min size.')).toBeTruthy();
  expect(getTargetDiscoverySnapshot('fixture').filterLimits.minSizePixels).toBe(
    100,
  );
  await fireEvent.changeText(
    screen.getByLabelText('Max size in pixels'),
    '200',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Min visibility duration in minutes'),
    '30',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Biggest' }));
  expect(getTargetDiscoverySnapshot('fixture')).toMatchObject({
    order: 'biggest',
    filterLimits: {
      minSizePixels: 100,
      maxSizePixels: 200,
      minDurationMinutes: 30,
    },
  });
  expect(
    screen.getByRole('button', { name: 'Longest Visible' }).props
      .accessibilityState.selected,
  ).toBe(false);
  await screen.unmount();
  const reopened = await render(<Controls />);
  await fireEvent.press(reopened.getByRole('button', { name: 'Advanced' }));
  expect(reopened.getByLabelText('Min size in pixels').props.value).toBe('100');
});

it('disables pixel fields without optics while leaving duration usable', async () => {
  const screen = await render(<Controls hasEquipment={false} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Advanced' }));
  expect(screen.getByLabelText('Min size in pixels').props.editable).toBe(
    false,
  );
  expect(screen.getByLabelText('Max size in pixels').props.editable).toBe(
    false,
  );
  await fireEvent.changeText(
    screen.getByLabelText('Min visibility duration in minutes'),
    '15',
  );
  expect(
    getTargetDiscoverySnapshot('fixture').filterLimits.minDurationMinutes,
  ).toBe(15);
});
