import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

import { createSkyViewport } from './skyViewport';
import { useSkyNavigation } from './useSkyNavigation';

const canvas = { widthPixels: 360, heightPixels: 640 };

const Harness = ({
  onManualNavigation,
}: {
  onManualNavigation: () => void;
}) => {
  const [viewport, setViewport] = useState(() =>
    createSkyViewport({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 180,
      horizontalSpanDegrees: 120,
    }),
  );
  const navigation = useSkyNavigation({
    canvas,
    onManualNavigation,
    setViewport,
    viewport,
  });
  return (
    <View>
      <Text testID="horizontal-span">{viewport.horizontalSpanDegrees}</Text>
      <Button
        onPress={() => navigation.beginPinch(180, 320)}
        title="Begin pinch"
      />
      <Button
        onPress={() => navigation.updatePinch(2, 180, 320)}
        title="Update pinch"
      />
      <Button onPress={navigation.finishPinch} title="Finish pinch" />
    </View>
  );
};

describe('useSkyNavigation', () => {
  it('rebases the canonical viewport once at release without incremental drift', async () => {
    const onManualNavigation = jest.fn();
    const view = await render(
      <Harness onManualNavigation={onManualNavigation} />,
    );

    await fireEvent.press(view.getByText('Begin pinch'));
    await fireEvent.press(view.getByText('Update pinch'));
    expect(view.getByTestId('horizontal-span').props.children).toBe(120);

    expect(view.getByTestId('horizontal-span').props.children).toBe(120);
    expect(onManualNavigation).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByText('Finish pinch'));
    expect(view.getByTestId('horizontal-span').props.children).toBe(60);
  });
});
