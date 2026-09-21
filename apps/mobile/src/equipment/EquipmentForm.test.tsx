import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { EquipmentForm } from './equipment-form';
import { createEquipmentFormDefaults } from './equipmentForm';

describe('EquipmentForm', () => {
  it('uses compact unit fields, previews FOV, and saves pixel resolution', async () => {
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
    await fireEvent.changeText(
      screen.getByLabelText('Resolution width'),
      '6250',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Resolution height'),
      '4149',
    );
    await fireEvent.changeText(screen.getByLabelText('Pixel size'), '3.76');

    expect(screen.getByText('3.37° × 2.23°')).toBeTruthy();
    expect(screen.getAllByText('mm')).toHaveLength(3);
    expect(screen.getByText('px')).toBeTruthy();
    expect(screen.queryByText('Frame rotation')).toBeNull();
    expect(screen.queryAllByPlaceholderText(/.+/)).toHaveLength(0);

    await fireEvent.press(screen.getByText('Save setup'));
    expect(onSave).toHaveBeenCalledWith({
      lensOffsetMillimeters: 0,
      name: 'Refractor',
      focalLengthMillimeters: 400,
      apertureMillimeters: 80,
      sensorWidthPixels: 6250,
      sensorHeightPixels: 4149,
      pixelSizeMicrometers: 3.76,
    });
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
          sensorWidthPixels: '6250',
          sensorHeightPixels: '4149',
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
