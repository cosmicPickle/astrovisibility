import {
  classifyMaskDirection,
  createVisibilityMask,
  type VisibilityMaskOperation,
} from './visibilityMask';

const seamCoverage = [
  [
    { azimuthDegrees: 350, altitudeDegrees: 5 },
    { azimuthDegrees: 10, altitudeDegrees: 5 },
    { azimuthDegrees: 10, altitudeDegrees: 90 },
    { azimuthDegrees: 350, altitudeDegrees: 90 },
  ],
];

const seamVisiblePolygon: VisibilityMaskOperation = {
  id: 'visible-seam',
  kind: 'visiblePolygon',
  points: [
    { azimuthDegrees: 355, altitudeDegrees: 10 },
    { azimuthDegrees: 5, altitudeDegrees: 10 },
    { azimuthDegrees: 5, altitudeDegrees: 30 },
    { azimuthDegrees: 355, altitudeDegrees: 30 },
  ],
};

describe('binary vector visibility mask', () => {
  it('supports multiple visible islands while blocking unmarked and uncaptured sky', () => {
    const mask = createVisibilityMask(
      [
        [
          { azimuthDegrees: 0, altitudeDegrees: 0 },
          { azimuthDegrees: 80, altitudeDegrees: 0 },
          { azimuthDegrees: 80, altitudeDegrees: 60 },
          { azimuthDegrees: 0, altitudeDegrees: 60 },
        ],
      ],
      [
        {
          id: 'island-a',
          kind: 'visiblePolygon',
          points: [
            { azimuthDegrees: 10, altitudeDegrees: 10 },
            { azimuthDegrees: 30, altitudeDegrees: 10 },
            { azimuthDegrees: 30, altitudeDegrees: 30 },
            { azimuthDegrees: 10, altitudeDegrees: 30 },
          ],
        },
        {
          id: 'island-b',
          kind: 'visiblePolygon',
          points: [
            { azimuthDegrees: 50, altitudeDegrees: 10 },
            { azimuthDegrees: 70, altitudeDegrees: 10 },
            { azimuthDegrees: 70, altitudeDegrees: 30 },
            { azimuthDegrees: 50, altitudeDegrees: 30 },
          ],
        },
      ],
    );

    expect(
      classifyMaskDirection(mask, { azimuthDegrees: 20, altitudeDegrees: 20 }),
    ).toBe('visible');
    expect(
      classifyMaskDirection(mask, { azimuthDegrees: 60, altitudeDegrees: 20 }),
    ).toBe('visible');
    expect(
      classifyMaskDirection(mask, { azimuthDegrees: 40, altitudeDegrees: 20 }),
    ).toBe('blocked');
    expect(
      classifyMaskDirection(mask, { azimuthDegrees: 100, altitudeDegrees: 20 }),
    ).toBe('blocked');
  });

  it('classifies normalized and unwrapped points consistently across north', () => {
    const mask = createVisibilityMask(seamCoverage, [seamVisiblePolygon]);

    for (const azimuthDegrees of [-1, 0, 1, 359, 360, 361]) {
      expect(
        classifyMaskDirection(mask, { azimuthDegrees, altitudeDegrees: 20 }),
      ).toBe('visible');
    }
    expect(
      classifyMaskDirection(mask, { azimuthDegrees: 180, altitudeDegrees: 20 }),
    ).toBe('blocked');
  });

  it('treats polygon, coverage, and stroke boundaries consistently as included', () => {
    const mask = createVisibilityMask(seamCoverage, [
      seamVisiblePolygon,
      {
        id: 'blocked-frame',
        kind: 'blockedStroke',
        angularRadiusDegrees: 0.05,
        points: [
          { azimuthDegrees: 359.8, altitudeDegrees: 20 },
          { azimuthDegrees: 0.2, altitudeDegrees: 20 },
        ],
      },
    ]);

    expect(
      classifyMaskDirection(mask, { azimuthDegrees: 355, altitudeDegrees: 20 }),
    ).toBe('visible');
    expect(
      classifyMaskDirection(mask, {
        azimuthDegrees: 0,
        altitudeDegrees: 20.05,
      }),
    ).toBe('blocked');
    expect(
      classifyMaskDirection(mask, { azimuthDegrees: 350, altitudeDegrees: 40 }),
    ).toBe('blocked');
  });

  it('uses ordered blocked and visible corrections with the latest matching stroke winning', () => {
    const mask = createVisibilityMask(seamCoverage, [
      seamVisiblePolygon,
      {
        id: 'branch',
        kind: 'blockedStroke',
        angularRadiusDegrees: 0.05,
        points: [
          { azimuthDegrees: 359.8, altitudeDegrees: 20 },
          { azimuthDegrees: 0.2, altitudeDegrees: 20 },
        ],
      },
      {
        id: 'branch-gap',
        kind: 'visibleStroke',
        angularRadiusDegrees: 0.01,
        points: [
          { azimuthDegrees: 359.98, altitudeDegrees: 20 },
          { azimuthDegrees: 0.02, altitudeDegrees: 20 },
        ],
      },
    ]);

    expect(
      classifyMaskDirection(mask, {
        azimuthDegrees: 359.9,
        altitudeDegrees: 20,
      }),
    ).toBe('blocked');
    expect(
      classifyMaskDirection(mask, { azimuthDegrees: 0, altitudeDegrees: 20 }),
    ).toBe('visible');
  });

  it('treats the zenith as one direction independent of azimuth', () => {
    const mask = createVisibilityMask(seamCoverage, [
      {
        id: 'zenith-window',
        kind: 'visiblePolygon',
        points: [
          { azimuthDegrees: 350, altitudeDegrees: 80 },
          { azimuthDegrees: 10, altitudeDegrees: 80 },
          { azimuthDegrees: 10, altitudeDegrees: 90 },
          { azimuthDegrees: 350, altitudeDegrees: 90 },
        ],
      },
    ]);

    for (const azimuthDegrees of [0, 90, 180, 270, 360]) {
      expect(
        classifyMaskDirection(mask, { azimuthDegrees, altitudeDegrees: 90 }),
      ).toBe('visible');
    }
  });

  it('rejects malformed or duplicate authoritative operations', () => {
    expect(() =>
      createVisibilityMask(seamCoverage, [
        seamVisiblePolygon,
        { ...seamVisiblePolygon },
      ]),
    ).toThrow('unique');
    expect(() =>
      createVisibilityMask(seamCoverage, [
        {
          id: 'bad-polygon',
          kind: 'visiblePolygon',
          points: [
            { azimuthDegrees: 0, altitudeDegrees: 10 },
            { azimuthDegrees: 1, altitudeDegrees: 10 },
          ],
        },
      ]),
    ).toThrow('at least 3');
  });
});
