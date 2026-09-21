import { createImagingFrame } from '../astronomy/imagingFrame';
import { directionToAtlasPixel } from '../panorama/directionalAtlas';
import { horizontalDirectionToVector } from '../sky/planetariumProjection';
import { createFrameMaskEvaluator } from './frameMaskIntersection';
import {
  createBlockedBitset,
  writeBlockedPixel,
  type RasterMask,
} from './rasterMask';

const raster = (): RasterMask => ({
  widthPixels: 2048,
  heightPixels: 2048,
  uri: 'synthetic',
  blockedBitset: createBlockedBitset(2048, 2048, false),
});
const frame = (azimuth = 0, altitude = 45, orientationDegrees = 0) =>
  createImagingFrame({
    horizontal: {
      azimuthDegreesClockwiseFromNorth: azimuth,
      refractedAltitudeDegrees: altitude,
    },
    observerLatitudeDegrees: 42,
    horizontalFovDegrees: 4,
    verticalFovDegrees: 2,
    orientationDegrees,
    trackingMode: 'altaz',
  });
const block = (
  mask: RasterMask,
  azimuthDegrees: number,
  altitudeDegrees: number,
) => {
  const point = directionToAtlasPixel(
    { azimuthDegrees, altitudeDegrees },
    mask,
  );
  writeBlockedPixel(
    mask.blockedBitset,
    mask.widthPixels,
    mask.heightPixels,
    Math.round(point.xPixels),
    Math.round(point.yPixels),
    true,
  );
};

describe('full-frame raster intersection', () => {
  it('finds cap intersections at the centre, away from it, and across the horizon', () => {
    const mask = raster();
    block(mask, 0, 45);
    const evaluator = createFrameMaskEvaluator(mask);
    const center = (altitudeDegrees: number, azimuthDegrees = 0) =>
      horizontalDirectionToVector({ altitudeDegrees, azimuthDegrees });
    expect(evaluator.capIntersects(center(45), 0.01, true)).toBe(true);
    expect(evaluator.capIntersects(center(46), 1.1, true)).toBe(true);
    expect(evaluator.capIntersects(center(46), 0.1, true)).toBe(false);
    expect(evaluator.capIntersects(center(45), 1, false)).toBe(true);
    expect(evaluator.capIntersects(center(-2), 1, false)).toBe(false);
    expect(evaluator.capIntersects(center(-0.1), 0.2, false)).toBe(true);
    expect(evaluator.capIntersects(center(0, 90), 0.1, false)).toBe(true);
  });

  it('includes the clamped outer half-pixel at the east horizon', () => {
    const mask = raster();
    writeBlockedPixel(mask.blockedBitset, 2048, 2048, 2047, 1024, true);
    const tinyFrame = createImagingFrame({
      horizontal: {
        azimuthDegreesClockwiseFromNorth: 90,
        refractedAltitudeDegrees: 0.02,
      },
      observerLatitudeDegrees: 42,
      horizontalFovDegrees: 0.005,
      verticalFovDegrees: 0.005,
      orientationDegrees: 0,
      trackingMode: 'altaz',
    });
    expect(createFrameMaskEvaluator(mask).isBlocked(tinyFrame)).toBe(true);
  });

  it('detects an interior blocked pixel missed by center, corners and edges', () => {
    const mask = raster();
    block(mask, 1, 45.4);
    expect(createFrameMaskEvaluator(mask).isBlocked(frame())).toBe(true);
  });

  it('does not shrink clear sky around a nearby obstruction', () => {
    const mask = raster();
    block(mask, 0, 47);
    expect(createFrameMaskEvaluator(mask).isBlocked(frame())).toBe(false);
    expect(createFrameMaskEvaluator(mask).isBlocked(frame(0, 45, 90))).toBe(
      true,
    );
  });

  it('detects a wall clipping the frame before its center', () => {
    const mask = raster();
    block(mask, 2.5, 45);
    expect(createFrameMaskEvaluator(mask).isBlocked(frame())).toBe(true);
  });

  it('handles wraparound and frames enclosing the zenith', () => {
    const mask = raster();
    block(mask, 359.5, 45);
    const evaluator = createFrameMaskEvaluator(mask);
    expect(evaluator.isBlocked(frame(0.5))).toBe(true);
    expect(evaluator.isBlocked(frame(0, 90))).toBe(false);
  });

  it('blocks a frame extending below the horizon, even on a clear raster', () => {
    expect(createFrameMaskEvaluator(raster()).isBlocked(frame(180, 0.5))).toBe(
      true,
    );
  });

  it('keeps a wholly clear frame visible and rejects malformed dimensions', () => {
    expect(createFrameMaskEvaluator(raster()).isBlocked(frame())).toBe(false);
    expect(() =>
      createFrameMaskEvaluator({ ...raster(), widthPixels: 4096 }),
    ).toThrow();
  });
});
