import type {
  SelectedTargetTrajectory,
  TrajectoryAssessment,
} from '../astronomy/trajectory';
import type { HorizontalDirectionDegrees } from './projection';

export interface ProjectedTrajectoryGroup {
  assessment: Exclude<TrajectoryAssessment, 'belowHorizon'>;
  directions: HorizontalDirectionDegrees[];
}

const directionForSample = (sample: {
  azimuthDegreesClockwiseFromNorth: number;
  refractedAltitudeDegrees: number;
}): HorizontalDirectionDegrees => ({
  altitudeDegrees: sample.refractedAltitudeDegrees,
  azimuthDegrees: sample.azimuthDegreesClockwiseFromNorth,
});

export const createProjectedTrajectoryGroups = (
  trajectory: SelectedTargetTrajectory | null,
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
    if (!current) {
      current = { assessment: sample.assessment, directions: [direction] };
      groups.push(current);
      continue;
    }
    if (current.assessment !== sample.assessment) {
      current.directions.push(direction);
      current = { assessment: sample.assessment, directions: [direction] };
      groups.push(current);
      continue;
    }
    current.directions.push(direction);
  }
  return groups;
};
