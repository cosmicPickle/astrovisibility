import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { EquipmentForm } from './equipment-form';
import { createEquipmentFormDefaults } from './equipmentForm';

describe('EquipmentForm', () => {
  it('shows a live FOV preview and saves valid values', async () => {
    const onSave = jest.fn();
    const screen = await render(
      <EquipmentForm
        initialValues={createEquipmentFormDefaults()}
        onSave={onSave}
        title="New imaging setup"
      />,
    );

    await fireEvent.changeText(
      screen.getByLabelText('Setup name'),
      'Refractor',
    );
    await fireEvent.changeText(screen.getByLabelText('Focal length'), '400');
    await fireEvent.changeText(screen.getByLabelText('Aperture'), '80');
    await fireEvent.changeText(screen.getByLabelText('Sensor width'), '23.5');
    await fireEvent.changeText(screen.getByLabelText('Sensor height'), '15.6');
    await fireEvent.changeText(screen.getByLabelText('Pixel size'), '3.76');

    expect(screen.getByText('3.37° × 2.23°')).toBeTruthy();
    expect(screen.getByText('Approximately 6250 × 4149 pixels')).toBeTruthy();

    await fireEvent.press(screen.getByText('Save setup'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Refractor',
        focalLengthMillimeters: 400,
        pixelSizeMicrometers: 3.76,
      }),
    );
  });

  it('blocks physically invalid values with a focused message', async () => {
    const onSave = jest.fn();
    const screen = await render(
      <EquipmentForm
        initialValues={{
          ...createEquipmentFormDefaults(),
          name: 'Broken setup',
          focalLengthMillimeters: '0',
          apertureMillimeters: '80',
          sensorWidthMillimeters: '23.5',
          sensorHeightMillimeters: '15.6',
          pixelSizeMicrometers: '3.76',
        }}
        onSave={onSave}
        title="New imaging setup"
      />,
    );

    await fireEvent.press(screen.getByText('Save setup'));

    await waitFor(() =>
      expect(
        screen.getByText('Focal length must be greater than 0.'),
      ).toBeTruthy(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});
