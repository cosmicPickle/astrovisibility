import type { VisibilityMask } from '../mask/visibilityMask';
import { projectMaskToViewport } from './maskOverlayGeometry';
import { createSkyViewport } from './skyViewport';

const mask: VisibilityMask = {
  coveragePolygons: [
    [
      { azimuthDegrees: 350, altitudeDegrees: 50 },
      { azimuthDegrees: 370, altitudeDegrees: 50 },
      { azimuthDegrees: 370, altitudeDegrees: 90 },
      { azimuthDegrees: 350, altitudeDegrees: 90 },
    ],
  ],
  operations: [
    {
      id: 'region',
      kind: 'visiblePolygon',
      points: [
        { azimuthDegrees: 355, altitudeDegrees: 60 },
        { azimuthDegrees: 365, altitudeDegrees: 60 },
        { azimuthDegrees: 360, altitudeDegrees: 90 },
      ],
    },
    {
      id: 'branch',
      kind: 'blockedStroke',
      angularRadiusDegrees: 0.05,
      points: [
        { azimuthDegrees: 359.9, altitudeDegrees: 70 },
        { azimuthDegrees: 360.1, altitudeDegrees: 80 },
      ],
    },
  ],
};

describe('mask overlay projection', () => {
  it('keeps seam and zenith geometry aligned with the sky viewport', () => {
    const projected = projectMaskToViewport(
      mask,
      createSkyViewport({
        centerAltitudeDegrees: 70,
        centerAzimuthDegrees: 0,
        horizontalSpanDegrees: 40,
      }),
      { widthPixels: 400, heightPixels: 400 },
    );
    expect(projected.operations).toHaveLength(2);
    expect(
      projected.operations[0].points.some(({ yPixels }) => yPixels === 0),
    ).toBe(true);
    expect(projected.operations[1]).toMatchObject({
      angularRadiusPixels: 0.5,
      kind: 'blockedStroke',
    });
    expect(
      projected.operations.every((operation) =>
        operation.points.every(({ xPixels }) => xPixels >= 0 && xPixels <= 400),
      ),
    ).toBe(true);
  });

  it('retains a polygon that surrounds the viewport even when every vertex is off-screen', () => {
    const surroundingPolygon: VisibilityMask = {
      coveragePolygons: [],
      operations: [
        {
          id: 'surrounding-region',
          kind: 'visiblePolygon',
          points: [
            { azimuthDegrees: 150, altitudeDegrees: 10 },
            { azimuthDegrees: 210, altitudeDegrees: 10 },
            { azimuthDegrees: 210, altitudeDegrees: 80 },
            { azimuthDegrees: 150, altitudeDegrees: 80 },
          ],
        },
      ],
    };

    const projected = projectMaskToViewport(
      surroundingPolygon,
      createSkyViewport({
        centerAltitudeDegrees: 45,
        centerAzimuthDegrees: 180,
        horizontalSpanDegrees: 40,
      }),
      { widthPixels: 400, heightPixels: 400 },
    );

    expect(projected.operations).toHaveLength(1);
    expect(projected.operations[0].id).toBe('surrounding-region-0');
  });
});
