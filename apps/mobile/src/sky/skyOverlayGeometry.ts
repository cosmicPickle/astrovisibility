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
  constrainSkyViewport,
  type SkyViewport,
} from './skyViewport';
import { unwrapAzimuthDegreesNear } from './projection';

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

const getTrajectoryViewportCenterAzimuth = (
  samples: readonly TrajectorySample[],
  viewport: SkyViewport,
) => {
  const unwrappedAzimuths = samples.map(
    ({ unwrappedAzimuthDegrees }) => unwrappedAzimuthDegrees,
  );
  const branchMidpoint =
    (Math.min(...unwrappedAzimuths) + Math.max(...unwrappedAzimuths)) / 2;
  return unwrapAzimuthDegreesNear(
    viewport.centerAzimuthDegrees,
    branchMidpoint,
  );
};

const projectTrajectorySample = (
  sample: Pick<TrajectorySample, 'refractedAltitudeDegrees'> & {
    unwrappedAzimuthDegrees: number;
  },
  viewportCenterAzimuthDegrees: number,
  rawViewport: SkyViewport,
  canvas: CanvasSizePixels,
) => {
  const viewport = constrainSkyViewport(rawViewport, canvas);
  if (
    sample.refractedAltitudeDegrees < 0 ||
    sample.refractedAltitudeDegrees > 90
  ) {
    return null;
  }
  const verticalSpanDegrees = getVerticalSpanDegrees(viewport, canvas);
  const azimuthOffsetDegrees =
    sample.unwrappedAzimuthDegrees - viewportCenterAzimuthDegrees;
  const altitudeOffsetDegrees =
    sample.refractedAltitudeDegrees - viewport.centerAltitudeDegrees;
  if (
    Math.abs(azimuthOffsetDegrees) > viewport.horizontalSpanDegrees / 2 ||
    Math.abs(altitudeOffsetDegrees) > verticalSpanDegrees / 2
  ) {
    return null;
  }
  return {
    xPixels:
      (0.5 + azimuthOffsetDegrees / viewport.horizontalSpanDegrees) *
      canvas.widthPixels,
    yPixels:
      (0.5 - altitudeOffsetDegrees / verticalSpanDegrees) * canvas.heightPixels,
  };
};

export const projectTrajectoryCoordinateToViewport = (
  coordinate: {
    azimuthDegreesClockwiseFromNorth: number;
    refractedAltitudeDegrees: number;
    timestampUtc: string;
  },
  samples: readonly TrajectorySample[],
  viewport: SkyViewport,
  canvas: CanvasSizePixels,
) => {
  if (samples.length === 0) return null;
  const timestampMilliseconds = Date.parse(coordinate.timestampUtc);
  const nearestSample = samples.reduce((nearest, candidate) =>
    Math.abs(Date.parse(candidate.timestampUtc) - timestampMilliseconds) <
    Math.abs(Date.parse(nearest.timestampUtc) - timestampMilliseconds)
      ? candidate
      : nearest,
  );
  return projectTrajectorySample(
    {
      refractedAltitudeDegrees: coordinate.refractedAltitudeDegrees,
      unwrappedAzimuthDegrees: unwrapAzimuthDegreesNear(
        coordinate.azimuthDegreesClockwiseFromNorth,
        nearestSample.unwrappedAzimuthDegrees,
      ),
    },
    getTrajectoryViewportCenterAzimuth(samples, viewport),
    viewport,
    canvas,
  );
};

const crossesProjectionDiscontinuity = (
  previousSample: TrajectorySample | null,
  previousPoint: TrajectoryViewportPoint | undefined,
  sample: TrajectorySample,
  point: { xPixels: number; yPixels: number } | null,
  canvas: CanvasSizePixels,
) => {
  if (!point || !previousPoint || !previousSample) return false;
  const horizontalDistance = Math.abs(point.xPixels - previousPoint.xPixels);
  return (
    horizontalDistance > canvas.widthPixels / 2 ||
    (Math.min(
      previousSample.refractedAltitudeDegrees,
      sample.refractedAltitudeDegrees,
    ) >= 85 &&
      horizontalDistance >= canvas.widthPixels / 4)
  );
};

export const buildTrajectoryViewportSegments = (
  samples: readonly TrajectorySample[],
  viewport: SkyViewport,
  canvas: CanvasSizePixels,
): TrajectoryViewportPoint[][] => {
  const segments: TrajectoryViewportPoint[][] = [];
  let current: TrajectoryViewportPoint[] = [];
  let previousSample: TrajectorySample | null = null;
  const viewportCenterAzimuthDegrees = getTrajectoryViewportCenterAzimuth(
    samples,
    viewport,
  );
  for (const sample of samples) {
    const projected = projectTrajectorySample(
      sample,
      viewportCenterAzimuthDegrees,
      viewport,
      canvas,
    );
    const previous = current[current.length - 1];
    const crossesCanvasSeam = crossesProjectionDiscontinuity(
      previousSample,
      previous,
      sample,
      projected,
      canvas,
    );
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
    previousSample = sample;
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
  let previousSample: TrajectorySample | null = null;
  const viewportCenterAzimuthDegrees = getTrajectoryViewportCenterAzimuth(
    samples,
    viewport,
  );
  for (const sample of samples) {
    const projected = projectTrajectorySample(
      sample,
      viewportCenterAzimuthDegrees,
      viewport,
      canvas,
    );
    const previous = current?.points.at(-1);
    const crossesCanvasSeam = crossesProjectionDiscontinuity(
      previousSample,
      previous,
      sample,
      projected,
      canvas,
    );
    if (
      !projected ||
      sample.assessment === 'belowHorizon' ||
      crossesCanvasSeam
    ) {
      if (current) segments.push(current);
      current = null;
    }
    if (!projected || sample.assessment === 'belowHorizon') {
      previousSample = sample;
      continue;
    }
    const point = {
      ...projected,
      altitudeDegrees: sample.refractedAltitudeDegrees,
      timestampUtc: sample.timestampUtc,
    };
    if (!current) {
      current = { assessment: sample.assessment, points: [point] };
      previousSample = sample;
      continue;
    }
    if (current.assessment !== sample.assessment) {
      current.points.push(point);
      segments.push(current);
      current = { assessment: sample.assessment, points: [point] };
      previousSample = sample;
      continue;
    }
    current.points.push(point);
    previousSample = sample;
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
