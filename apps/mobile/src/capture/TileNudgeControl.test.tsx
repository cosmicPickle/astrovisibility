import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { TileNudgeControl } from './TileNudgeControl';

describe('TileNudgeControl', () => {
  it('uses a non-overlapping orthogonal layout with reciprocal button dimensions', async () => {
    const view = await render(
      <TileNudgeControl
        onDown={jest.fn()}
        onLeft={jest.fn()}
        onRight={jest.fn()}
        onUp={jest.fn()}
      />,
    );

    const up = StyleSheet.flatten(
      view.getByLabelText('Move selected tile up').props.style,
    );
    const down = StyleSheet.flatten(
      view.getByLabelText('Move selected tile down').props.style,
    );
    const left = StyleSheet.flatten(
      view.getByLabelText('Move selected tile left').props.style,
    );
    const right = StyleSheet.flatten(
      view.getByLabelText('Move selected tile right').props.style,
    );

    expect(up.width).toBe(left.height);
    expect(up.height).toBe(left.width);
    expect(down).toMatchObject({ height: up.height, width: up.width });
    expect(right).toMatchObject({ height: left.height, width: left.width });
    expect(up.bottom).toBeUndefined();
    expect(down.top).toBeUndefined();
    expect(left.right).toBeUndefined();
    expect(right.left).toBeUndefined();
  });

  it('uses one rotated arrow glyph for every direction', async () => {
    const view = await render(
      <TileNudgeControl
        onDown={jest.fn()}
        onLeft={jest.fn()}
        onRight={jest.fn()}
        onUp={jest.fn()}
      />,
    );

    expect(view.getAllByText('↑')).toHaveLength(4);
    expect(view.queryByText('→')).toBeNull();
    expect(view.queryByText('↓')).toBeNull();
    expect(view.queryByText('←')).toBeNull();
  });
});
