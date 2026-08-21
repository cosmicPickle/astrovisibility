import { isTimestampInIntervals } from '../astronomy/astronomicalDarkness';
import type {
  SelectedTargetTrajectory,
  TrajectorySample,
  VisibilityInterval,
} from '../astronomy/trajectory';
import type { HorizontalDirectionDegrees } from './projection';

export interface ProjectedTrajectoryGroup {
  kind: 'blocked' | 'astronomicalDarkness' | 'daytime';
  directions: HorizontalDirectionDegrees[];
}

const renderKindForSample = (
  sample: TrajectorySample,
  astronomicalDarknessIntervals: readonly VisibilityInterval[],
): ProjectedTrajectoryGroup['kind'] => {
  if (sample.assessment === 'blocked') return 'blocked';
  return isTimestampInIntervals(
    sample.timestampUtc,
    astronomicalDarknessIntervals,
  )
    ? 'astronomicalDarkness'
    : 'daytime';
};

const directionForSample = (sample: {
  azimuthDegreesClockwiseFromNorth: number;
  refractedAltitudeDegrees: number;
}): HorizontalDirectionDegrees => ({
  altitudeDegrees: sample.refractedAltitudeDegrees,
  azimuthDegrees: sample.azimuthDegreesClockwiseFromNorth,
});

export const createProjectedTrajectoryGroups = (
  trajectory: SelectedTargetTrajectory | null,
  astronomicalDarknessIntervals: readonly VisibilityInterval[] = [],
): ProjectedTrajectoryGroup[] => {
  if (!trajectory) return [];
  const groups: ProjectedTrajectoryGroup[] = [];
  let current: ProjectedTrajectoryGroup | null = null;
  for (const sample of trajectory.samples) {
    if (sample.assessment === 'belowHorizon') {
      current = null;
      continue;
    }
    const direction = directionForSample(sample);
    const kind = renderKindForSample(sample, astronomicalDarknessIntervals);
    if (!current) {
      current = { kind, directions: [direction] };
      groups.push(current);
      continue;
    }
    if (current.kind !== kind) {
      current.directions.push(direction);
      current = { kind, directions: [direction] };
      groups.push(current);
      continue;
    }
    current.directions.push(direction);
  }
  return groups;
};
