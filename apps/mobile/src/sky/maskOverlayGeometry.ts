import type { VisibilityMask } from '../mask/visibilityMask';
import type { CanvasSizePixels } from './projection';
import { unwrapAzimuthDegreesNear } from './projection';
import {
  directionToPanoramaEditorPoint,
  panoramaEditorAngularRadiusToPixels,
  projectPanoramaEditorPoint,
  type PanoramaEditorViewport,
} from './panoramaOverlayGeometry';
import {
  constrainSkyViewport,
  getVerticalSpanDegrees,
  type SkyViewport,
} from './skyViewport';

export interface ProjectedMaskPoint {
  xPixels: number;
  yPixels: number;
}

export interface ProjectedMaskOperation {
  id: string;
  kind: 'blockedStroke' | 'visiblePolygon' | 'visibleStroke';
  points: ProjectedMaskPoint[];
  angularRadiusPixels?: number;
}

export interface ProjectedVisibilityMask {
  operations: ProjectedMaskOperation[];
}

export function projectMaskToPanoramaEditorViewport(
  mask: VisibilityMask,
  viewport: PanoramaEditorViewport,
  canvas: CanvasSizePixels,
): ProjectedVisibilityMask {
  return {
    operations: mask.operations.flatMap((operation) => {
      const points = operation.points.map((point) => {
        const projected = projectPanoramaEditorPoint(
          directionToPanoramaEditorPoint(point),
          viewport,
          canvas,
        );
        return { xPixels: projected.xPixels, yPixels: projected.yPixels };
      });
      const radiusPixels =
        operation.kind === 'visiblePolygon'
          ? 0
          : panoramaEditorAngularRadiusToPixels(
              operation.angularRadiusDegrees,
              viewport,
              canvas,
            );
      const entirelyOutsideViewport =
        points.every(({ xPixels }) => xPixels < -radiusPixels) ||
        points.every(
          ({ xPixels }) => xPixels > canvas.widthPixels + radiusPixels,
        ) ||
        points.every(({ yPixels }) => yPixels < -radiusPixels) ||
        points.every(
          ({ yPixels }) => yPixels > canvas.heightPixels + radiusPixels,
        );
      if (entirelyOutsideViewport) return [];
      return [
        {
          id: operation.id,
          kind: operation.kind,
          points,
          ...(operation.kind === 'visiblePolygon'
            ? {}
            : { angularRadiusPixels: radiusPixels }),
        },
      ];
    }),
  };
}

export function projectMaskToViewport(
  mask: VisibilityMask,
  rawViewport: SkyViewport,
  canvas: CanvasSizePixels,
): ProjectedVisibilityMask {
  const viewport = constrainSkyViewport(rawViewport, canvas);
  const verticalSpanDegrees = getVerticalSpanDegrees(viewport, canvas);
  const horizontalPixelsPerDegree =
    canvas.widthPixels / viewport.horizontalSpanDegrees;

  return {
    operations: mask.operations.flatMap((operation) => {
      const referenceAzimuthDegrees =
        operation.points.reduce((sum, point) => sum + point.azimuthDegrees, 0) /
        operation.points.length;
      const nearestReference = unwrapAzimuthDegreesNear(
        referenceAzimuthDegrees,
        viewport.centerAzimuthDegrees,
      );
      return [-360, 0, 360].flatMap((wrapOffsetDegrees) => {
        const reference = nearestReference + wrapOffsetDegrees;
        const points = operation.points.map((point) => ({
          xPixels:
            (0.5 +
              (unwrapAzimuthDegreesNear(point.azimuthDegrees, reference) -
                viewport.centerAzimuthDegrees) /
                viewport.horizontalSpanDegrees) *
            canvas.widthPixels,
          yPixels:
            (0.5 -
              (point.altitudeDegrees - viewport.centerAltitudeDegrees) /
                verticalSpanDegrees) *
            canvas.heightPixels,
        }));
        const radiusPixels =
          operation.kind === 'visiblePolygon'
            ? 0
            : operation.angularRadiusDegrees * horizontalPixelsPerDegree;
        const entirelyOutsideViewport =
          points.every(({ xPixels }) => xPixels < -radiusPixels) ||
          points.every(
            ({ xPixels }) => xPixels > canvas.widthPixels + radiusPixels,
          ) ||
          points.every(({ yPixels }) => yPixels < -radiusPixels) ||
          points.every(
            ({ yPixels }) => yPixels > canvas.heightPixels + radiusPixels,
          );
        if (entirelyOutsideViewport) {
          return [];
        }
        return [
          {
            id: `${operation.id}-${wrapOffsetDegrees}`,
            kind: operation.kind,
            points,
            ...(operation.kind === 'visiblePolygon'
              ? {}
              : { angularRadiusPixels: radiusPixels }),
          },
        ];
      });
    }),
  };
}
