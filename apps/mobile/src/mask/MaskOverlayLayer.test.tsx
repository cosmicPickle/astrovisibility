import { render } from '@testing-library/react-native';
import { processColor } from 'react-native';
import Svg from 'react-native-svg';

import { colors } from '../theme/tokens';
import { MaskOverlayLayer } from './MaskOverlayLayer';
import type { VisibilityMask } from './visibilityMask';

const mask: VisibilityMask = {
  coveragePolygons: [],
  operations: [
    {
      id: 'draw',
      kind: 'blockedStroke',
      angularRadiusDegrees: 2,
      points: [
        { azimuthDegrees: 5, altitudeDegrees: 40 },
        { azimuthDegrees: 10, altitudeDegrees: 45 },
      ],
    },
    {
      id: 'erase',
      kind: 'visibleStroke',
      angularRadiusDegrees: 1,
      points: [{ azimuthDegrees: 8, altitudeDegrees: 43 }],
    },
  ],
};

describe('MaskOverlayLayer', () => {
  it('composites draw and erase as one hard-edged red obstacle mask', async () => {
    const screen = await render(
      <Svg height={200} width={200}>
        <MaskOverlayLayer
          canvas={{ heightPixels: 200, widthPixels: 200 }}
          mask={mask}
          opacityPercent={76}
          viewport={{ centerX: 0, centerY: -0.5, horizontalSpan: 0.8 }}
        />
      </Svg>,
    );

    const fill = screen.getByTestId('obstacle-mask-fill').props;
    expect(fill.fill.payload).toBe(processColor(colors.danger));
    expect(fill.fillOpacity).toBe(0.76);
    expect(
      screen.getByTestId('obstacle-mask-blockedStroke-draw').props,
    ).toMatchObject({
      strokeLinecap: 1,
      strokeLinejoin: 1,
    });
    expect(
      screen.getByTestId('obstacle-mask-blockedStroke-draw').props.stroke
        .payload,
    ).toBe(processColor('white'));
    expect(
      screen.getByTestId('obstacle-mask-blockedStroke-draw').props
        .strokeDasharray,
    ).toBeUndefined();
    expect(
      screen.getByTestId('obstacle-mask-visibleStroke-erase').props.fill
        .payload,
    ).toBe(processColor('black'));
  });
});
