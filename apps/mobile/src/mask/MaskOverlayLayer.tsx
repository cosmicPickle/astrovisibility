import { Fragment } from 'react';
import { Circle, Path, Polygon, Rect } from 'react-native-svg';

import type { VisibilityMask } from './visibilityMask';
import { colors } from '../theme/tokens';
import { projectMaskToViewport } from '../sky/maskOverlayGeometry';
import type { SkyViewport } from '../sky/skyViewport';

export function MaskOverlayLayer({
  canvas,
  mask,
  opacityPercent,
  viewport,
}: {
  canvas: { widthPixels: number; heightPixels: number };
  mask: VisibilityMask;
  opacityPercent: number;
  viewport: SkyViewport;
}) {
  const opacity = Math.max(0, Math.min(100, opacityPercent)) / 100;
  const projected = projectMaskToViewport(mask, viewport, canvas);
  return (
    <>
      <Rect
        fill={colors.blocked}
        fillOpacity={opacity * 0.2}
        height={canvas.heightPixels}
        width={canvas.widthPixels}
        x={0}
        y={0}
      />
      {projected.operations.map((operation) => {
        if (operation.kind === 'visiblePolygon') {
          return (
            <Polygon
              fill={colors.primary}
              fillOpacity={opacity * 0.3}
              key={operation.id}
              points={operation.points
                .map(({ xPixels, yPixels }) => `${xPixels},${yPixels}`)
                .join(' ')}
              stroke={colors.primary}
              strokeOpacity={opacity}
              strokeWidth={2}
            />
          );
        }
        const path = operation.points
          .map(
            ({ xPixels, yPixels }, index) =>
              `${index === 0 ? 'M' : 'L'} ${xPixels} ${yPixels}`,
          )
          .join(' ');
        const visible = operation.kind === 'visibleStroke';
        const stroke = visible ? colors.primary : colors.blocked;
        const width = Math.max(1, (operation.angularRadiusPixels ?? 0) * 2);
        return (
          <Fragment key={operation.id}>
            {operation.points.length === 1 ? (
              <Circle
                cx={operation.points[0].xPixels}
                cy={operation.points[0].yPixels}
                fill={stroke}
                fillOpacity={opacity * 0.55}
                r={width / 2}
                stroke={visible ? colors.text : colors.outline}
                strokeDasharray={visible ? undefined : '4 3'}
              />
            ) : (
              <Path
                d={path}
                fill="none"
                stroke={stroke}
                strokeDasharray={visible ? undefined : '6 4'}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={opacity * 0.7}
                strokeWidth={width}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}
