import {
  Circle,
  Defs,
  Image as SvgImage,
  Mask as SvgMask,
  Path,
  Rect,
} from 'react-native-svg';

import type { AngularPointDegrees, VisibilityMask } from './visibilityMask';
import { colors } from '../theme/tokens';
import { projectMaskToPanoramaEditorViewport } from '../sky/maskOverlayGeometry';
import type { PanoramaEditorViewport } from '../sky/panoramaOverlayGeometry';
import { projectDirectionalAtlasRect } from './PanoramaEditorLayer';

type DraftMaskStroke = Readonly<{
  angularRadiusDegrees: number;
  kind: 'blockedStroke' | 'visibleStroke';
  points: readonly AngularPointDegrees[];
}>;

const MASK_ID = 'editor-obstacle-mask';

export function MaskOverlayLayer({
  canvas,
  draftStroke,
  mask,
  opacityPercent,
  viewport,
}: {
  canvas: { widthPixels: number; heightPixels: number };
  draftStroke?: DraftMaskStroke | null;
  mask: VisibilityMask;
  opacityPercent: number;
  viewport: PanoramaEditorViewport;
}) {
  const opacity = Math.max(0, Math.min(100, opacityPercent)) / 100;
  const projected = projectMaskToPanoramaEditorViewport(
    draftStroke
      ? {
          ...mask,
          operations: [
            ...mask.operations,
            { ...draftStroke, id: 'draft-obstacle-stroke' },
          ],
        }
      : mask,
    viewport,
    canvas,
  );
  const strokes = projected.operations.filter(
    (operation) => operation.kind !== 'visiblePolygon',
  );
  const atlasRect = projectDirectionalAtlasRect(viewport, canvas);
  return (
    <>
      <Defs>
        <SvgMask
          height={canvas.heightPixels}
          id={MASK_ID}
          maskType="luminance"
          maskUnits="userSpaceOnUse"
          width={canvas.widthPixels}
          x={0}
          y={0}
        >
          <Rect
            fill="black"
            height={canvas.heightPixels}
            width={canvas.widthPixels}
            x={0}
            y={0}
          />
          {mask.raster ? (
            <SvgImage
              height={atlasRect.height}
              href={{ uri: mask.raster.uri }}
              preserveAspectRatio="none"
              width={atlasRect.width}
              x={atlasRect.x}
              y={atlasRect.y}
            />
          ) : null}
          {strokes.map((operation) => {
            const paint =
              operation.kind === 'blockedStroke' ? 'white' : 'black';
            const width = Math.max(1, (operation.angularRadiusPixels ?? 0) * 2);
            if (operation.points.length === 1) {
              const point = operation.points[0]!;
              return (
                <Circle
                  cx={point.xPixels}
                  cy={point.yPixels}
                  fill={paint}
                  key={operation.id}
                  r={width / 2}
                  testID={`obstacle-mask-${operation.kind}-${operation.id}`}
                />
              );
            }
            const path = operation.points
              .map(
                ({ xPixels, yPixels }, index) =>
                  `${index === 0 ? 'M' : 'L'} ${xPixels} ${yPixels}`,
              )
              .join(' ');
            return (
              <Path
                d={path}
                fill="none"
                key={operation.id}
                stroke={paint}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={width}
                testID={`obstacle-mask-${operation.kind}-${operation.id}`}
              />
            );
          })}
        </SvgMask>
      </Defs>
      <Rect
        fill={colors.danger}
        fillOpacity={opacity}
        height={canvas.heightPixels}
        mask={`url(#${MASK_ID})`}
        width={canvas.widthPixels}
        x={0}
        y={0}
        testID="obstacle-mask-fill"
      />
    </>
  );
}
