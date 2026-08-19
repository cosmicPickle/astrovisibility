import {
  createSyntheticSkyData,
  selectSyntheticViewportTargets,
} from './syntheticSkyData';

describe('synthetic Stage 0 render load', () => {
  it('is deterministic and mounts only a bounded viewport subset', () => {
    const first = createSyntheticSkyData(12_000);
    const second = createSyntheticSkyData(12_000);

    expect(first.targets.slice(0, 5)).toEqual(second.targets.slice(0, 5));
    expect(first.targets).toHaveLength(12_000);
    expect(
      selectSyntheticViewportTargets(first.targets, {
        minimumAzimuthDegrees: 330,
        maximumAzimuthDegrees: 390,
        minimumAltitudeDegrees: 0,
        maximumAltitudeDegrees: 90,
        limit: 350,
      }).length,
    ).toBeLessThanOrEqual(350);
  });
});
