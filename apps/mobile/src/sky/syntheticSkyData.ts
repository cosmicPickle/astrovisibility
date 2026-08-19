import type { AngularPointDegrees } from '../mask/visibilityMask';
import { unwrapAzimuthDegreesNear } from './projection';

export type SyntheticTarget = AngularPointDegrees & {
  id: string;
  radiusDegrees: number;
  prominence: number;
};

export type SyntheticSkyData = {
  targets: SyntheticTarget[];
  trajectory: AngularPointDegrees[];
};

export type SyntheticViewport = {
  minimumAzimuthDegrees: number;
  maximumAzimuthDegrees: number;
  minimumAltitudeDegrees: number;
  maximumAltitudeDegrees: number;
  limit: number;
};

const createPseudoRandom = () => {
  let state = 0x5a17_0f0f;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

export const createSyntheticSkyData = (
  targetCount: number,
): SyntheticSkyData => {
  if (!Number.isInteger(targetCount) || targetCount < 0) {
    throw new RangeError('targetCount must be a non-negative integer');
  }
  const random = createPseudoRandom();
  const targets = Array.from({ length: targetCount }, (_, index) => ({
    id: `synthetic-${index}`,
    azimuthDegrees: random() * 360,
    altitudeDegrees: 4 + random() * 84,
    radiusDegrees: 0.08 + random() * 0.8,
    prominence: Math.floor(random() * 5),
  }));
  const trajectory = Array.from({ length: 49 }, (_, index) => ({
    azimuthDegrees: 330 + index * 2.25,
    altitudeDegrees: 18 + Math.sin((index / 48) * Math.PI) * 56,
  }));
  return { targets, trajectory };
};

export const selectSyntheticViewportTargets = (
  targets: SyntheticTarget[],
  viewport: SyntheticViewport,
) => {
  const referenceAzimuth =
    (viewport.minimumAzimuthDegrees + viewport.maximumAzimuthDegrees) / 2;
  return targets
    .filter((target) => {
      const unwrappedAzimuth = unwrapAzimuthDegreesNear(
        target.azimuthDegrees,
        referenceAzimuth,
      );
      return (
        unwrappedAzimuth >= viewport.minimumAzimuthDegrees &&
        unwrappedAzimuth <= viewport.maximumAzimuthDegrees &&
        target.altitudeDegrees >= viewport.minimumAltitudeDegrees &&
        target.altitudeDegrees <= viewport.maximumAltitudeDegrees
      );
    })
    .sort(
      (left, right) =>
        left.prominence - right.prominence || left.id.localeCompare(right.id),
    )
    .slice(0, Math.max(0, viewport.limit));
};
