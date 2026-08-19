import type {
  TrajectoryAssessment,
  TrajectorySample,
} from '../astronomy/trajectory';
import {
  createRotatedFieldOfViewRectangle,
  type FieldOfViewInput,
} from '../equipment/fieldOfView';
import type { CanvasSizePixels } from './projection';
import {
  getVerticalSpanDegrees,
  projectDirectionToViewport,
  type SkyViewport,
} from './skyViewport';

export interface TrajectoryViewportPoint {
  xPixels: number;
  yPixels: number;
  altitudeDegrees: number;
  timestampUtc: string;
}

export interface ClassifiedTrajectoryViewportSegment {
  assessment: Exclude<TrajectoryAssessment, 'belowHorizon'>;
  points: TrajectoryViewportPoint[];
}

export const buildTrajectoryViewportSegments = (
  samples: readonly TrajectorySample[],
  viewport: SkyViewport,
  canvas: CanvasSizePixels,
): TrajectoryViewportPoint[][] => {
  const segments: TrajectoryViewportPoint[][] = [];
  let current: TrajectoryViewportPoint[] = [];
  for (const sample of samples) {
    const projected = projectDirectionToViewport(
      {
        altitudeDegrees: sample.refractedAltitudeDegrees,
        azimuthDegrees: sample.azimuthDegreesClockwiseFromNorth,
      },
      viewport,
      canvas,
    );
    const previous = current[current.length - 1];
    const crossesCanvasSeam =
      projected && previous
        ? Math.abs(projected.xPixels - previous.xPixels) >
          canvas.widthPixels / 2
        : false;
    if (
      !projected ||
      sample.assessment === 'belowHorizon' ||
      crossesCanvasSeam
    ) {
      if (current.length > 0) segments.push(current);
      current = [];
    }
    if (projected && sample.assessment !== 'belowHorizon') {
      current.push({
        ...projected,
        altitudeDegrees: sample.refractedAltitudeDegrees,
        timestampUtc: sample.timestampUtc,
      });
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
};

export const buildClassifiedTrajectoryViewportSegments = (
  samples: readonly TrajectorySample[],
  viewport: SkyViewport,
  canvas: CanvasSizePixels,
): ClassifiedTrajectoryViewportSegment[] => {
  const segments: ClassifiedTrajectoryViewportSegment[] = [];
  let current: ClassifiedTrajectoryViewportSegment | null = null;
  for (const sample of samples) {
    const projected = projectDirectionToViewport(
      {
        altitudeDegrees: sample.refractedAltitudeDegrees,
        azimuthDegrees: sample.azimuthDegreesClockwiseFromNorth,
      },
      viewport,
      canvas,
    );
    const previous = current?.points.at(-1);
    const crossesCanvasSeam =
      projected && previous
        ? Math.abs(projected.xPixels - previous.xPixels) >
          canvas.widthPixels / 2
        : false;
    if (
      !projected ||
      sample.assessment === 'belowHorizon' ||
      crossesCanvasSeam
    ) {
      if (current) segments.push(current);
      current = null;
    }
    if (!projected || sample.assessment === 'belowHorizon') continue;
    const point = {
      ...projected,
      altitudeDegrees: sample.refractedAltitudeDegrees,
      timestampUtc: sample.timestampUtc,
    };
    if (!current) {
      current = { assessment: sample.assessment, points: [point] };
      continue;
    }
    if (current.assessment !== sample.assessment) {
      current.points.push(point);
      segments.push(current);
      current = { assessment: sample.assessment, points: [point] };
      continue;
    }
    current.points.push(point);
  }
  if (current) segments.push(current);
  return segments;
};

export const projectFieldOfViewToViewport = (
  center: { azimuthDegrees: number; altitudeDegrees: number },
  equipment: FieldOfViewInput & { frameRotationDegrees: number },
  viewport: SkyViewport,
  canvas: CanvasSizePixels,
) => {
  const projectedCenter = projectDirectionToViewport(center, viewport, canvas);
  if (!projectedCenter) return null;
  const rectangle = createRotatedFieldOfViewRectangle(equipment);
  const verticalSpanDegrees = getVerticalSpanDegrees(viewport, canvas);
  return {
    ...rectangle,
    points: rectangle.corners.map((corner) => ({
      xPixels:
        projectedCenter.xPixels +
        (corner.horizontalOffsetDegrees / viewport.horizontalSpanDegrees) *
          canvas.widthPixels,
      yPixels:
        projectedCenter.yPixels -
        (corner.verticalOffsetDegrees / verticalSpanDegrees) *
          canvas.heightPixels,
    })),
  };
};
