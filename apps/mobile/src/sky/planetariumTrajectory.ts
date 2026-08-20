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
  for (const sample of trajectory.samples) {
    if (sample.assessment === 'belowHorizon') continue;
    const direction = directionForSample(sample);
    const current = groups.at(-1);
    if (!current) {
      groups.push({ assessment: sample.assessment, directions: [direction] });
      continue;
    }
    if (current.assessment !== sample.assessment) {
      current.directions.push(direction);
      groups.push({ assessment: sample.assessment, directions: [direction] });
      continue;
    }
    current.directions.push(direction);
  }
  return groups;
};
