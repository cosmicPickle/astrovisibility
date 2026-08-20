import {
  normalizeAzimuthDegrees,
  unwrapAzimuthDegreesNear,
} from '../sky/projection';

export type AngularPointDegrees = Readonly<{
  azimuthDegrees: number;
  altitudeDegrees: number;
}>;

export type VisiblePolygonOperation = Readonly<{
  id: string;
  kind: 'visiblePolygon';
  points: readonly AngularPointDegrees[];
}>;

export type MaskCorrectionOperation = Readonly<{
  id: string;
  kind: 'blockedStroke' | 'visibleStroke';
  angularRadiusDegrees: number;
  points: readonly AngularPointDegrees[];
}>;

export type VisibilityMaskOperation =
  VisiblePolygonOperation | MaskCorrectionOperation;
export type VisibilityMask = Readonly<{
  coveragePolygons: readonly (readonly AngularPointDegrees[])[];
  operations: readonly VisibilityMaskOperation[];
}>;
export type MaskClassification = 'blocked' | 'visible';

const GEOMETRY_EPSILON_DEGREES = 1e-9;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_MASK_OPERATIONS = 10_000;
const MAX_POINTS_PER_OPERATION = 10_000;
const MAX_TOTAL_POINTS = 100_000;

function canonicalizePoint(
  point: AngularPointDegrees,
  previousAzimuthDegrees?: number,
): AngularPointDegrees {
  if (
    !Number.isFinite(point.azimuthDegrees) ||
    !Number.isFinite(point.altitudeDegrees)
  ) {
    throw new RangeError('Mask coordinates must be finite.');
  }
  if (point.altitudeDegrees < 0 || point.altitudeDegrees > 90) {
    throw new RangeError('Mask altitudeDegrees must be within 0..90.');
  }
  const azimuthDegrees =
    previousAzimuthDegrees === undefined
      ? normalizeAzimuthDegrees(point.azimuthDegrees)
      : unwrapAzimuthDegreesNear(point.azimuthDegrees, previousAzimuthDegrees);
  return Object.freeze({
    azimuthDegrees,
    altitudeDegrees: point.altitudeDegrees,
  });
}

function canonicalizePath(
  points: readonly AngularPointDegrees[],
  minimumPoints: number,
  label: string,
): readonly AngularPointDegrees[] {
  if (points.length < minimumPoints) {
    throw new RangeError(`${label} requires at least ${minimumPoints} points.`);
  }
  if (points.length > MAX_POINTS_PER_OPERATION) {
    throw new RangeError(
      `${label} exceeds the ${MAX_POINTS_PER_OPERATION} point limit.`,
    );
  }
  const canonical: AngularPointDegrees[] = [];
  for (const point of points) {
    canonical.push(canonicalizePoint(point, canonical.at(-1)?.azimuthDegrees));
  }
  return Object.freeze(canonical);
}

function validateOperationId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error('Mask operation id must be a safe 1-64 character id.');
  }
}

export function canonicalizeMaskOperation(
  operation: VisibilityMaskOperation,
): VisibilityMaskOperation {
  validateOperationId(operation.id);
  if (operation.kind === 'visiblePolygon') {
    return Object.freeze({
      id: operation.id,
      kind: operation.kind,
      points: canonicalizePath(operation.points, 3, 'A visible polygon'),
    });
  }
  if (
    !Number.isFinite(operation.angularRadiusDegrees) ||
    operation.angularRadiusDegrees <= 0 ||
    operation.angularRadiusDegrees > 180
  ) {
    throw new RangeError(
      'A correction angularRadiusDegrees must be within 0..180.',
    );
  }
  return Object.freeze({
    id: operation.id,
    kind: operation.kind,
    angularRadiusDegrees: operation.angularRadiusDegrees,
    points: canonicalizePath(operation.points, 1, 'A correction stroke'),
  });
}

export function canonicalizeMaskOperations(
  operations: readonly VisibilityMaskOperation[],
): readonly VisibilityMaskOperation[] {
  if (operations.length > MAX_MASK_OPERATIONS) {
    throw new RangeError(
      `A mask exceeds the ${MAX_MASK_OPERATIONS} operation limit.`,
    );
  }
  const ids = new Set<string>();
  let pointCount = 0;
  const polygons: VisibilityMaskOperation[] = [];
  const corrections: VisibilityMaskOperation[] = [];
  for (const operation of operations) {
    if (ids.has(operation.id))
      throw new Error('Mask operation ids must be unique.');
    ids.add(operation.id);
    const canonical = canonicalizeMaskOperation(operation);
    pointCount += canonical.points.length;
    (canonical.kind === 'visiblePolygon' ? polygons : corrections).push(
      canonical,
    );
  }
  if (pointCount > MAX_TOTAL_POINTS) {
    throw new RangeError(
      `A mask exceeds the ${MAX_TOTAL_POINTS} total point limit.`,
    );
  }
  return Object.freeze([...polygons, ...corrections]);
}

export function canonicalizeCoveragePolygons(
  polygons: readonly (readonly AngularPointDegrees[])[],
): readonly (readonly AngularPointDegrees[])[] {
  if (polygons.length > 200)
    throw new RangeError('Panorama coverage exceeds the 200 tile limit.');
  return Object.freeze(
    polygons.map((polygon) =>
      canonicalizePath(polygon, 3, 'A coverage polygon'),
    ),
  );
}

export function createVisibilityMask(
  coveragePolygons: readonly (readonly AngularPointDegrees[])[],
  operations: readonly VisibilityMaskOperation[],
): VisibilityMask {
  return Object.freeze({
    coveragePolygons: canonicalizeCoveragePolygons(coveragePolygons),
    operations: canonicalizeMaskOperations(operations),
  });
}

function squaredDistanceToSegment(
  point: AngularPointDegrees,
  start: AngularPointDegrees,
  end: AngularPointDegrees,
) {
  const segmentAzimuth = end.azimuthDegrees - start.azimuthDegrees;
  const segmentAltitude = end.altitudeDegrees - start.altitudeDegrees;
  const squaredLength = segmentAzimuth ** 2 + segmentAltitude ** 2;
  if (squaredLength <= GEOMETRY_EPSILON_DEGREES) {
    return (
      (point.azimuthDegrees - start.azimuthDegrees) ** 2 +
      (point.altitudeDegrees - start.altitudeDegrees) ** 2
    );
  }
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.azimuthDegrees - start.azimuthDegrees) * segmentAzimuth +
        (point.altitudeDegrees - start.altitudeDegrees) * segmentAltitude) /
        squaredLength,
    ),
  );
  const closestAzimuth = start.azimuthDegrees + projection * segmentAzimuth;
  const closestAltitude = start.altitudeDegrees + projection * segmentAltitude;
  return (
    (point.azimuthDegrees - closestAzimuth) ** 2 +
    (point.altitudeDegrees - closestAltitude) ** 2
  );
}

function segmentsIntersect(
  firstStart: AngularPointDegrees,
  firstEnd: AngularPointDegrees,
  secondStart: AngularPointDegrees,
  secondEnd: AngularPointDegrees,
): boolean {
  const cross = (
    origin: AngularPointDegrees,
    end: AngularPointDegrees,
    point: AngularPointDegrees,
  ) =>
    (end.azimuthDegrees - origin.azimuthDegrees) *
      (point.altitudeDegrees - origin.altitudeDegrees) -
    (end.altitudeDegrees - origin.altitudeDegrees) *
      (point.azimuthDegrees - origin.azimuthDegrees);
  const firstSideStart = cross(firstStart, firstEnd, secondStart);
  const firstSideEnd = cross(firstStart, firstEnd, secondEnd);
  const secondSideStart = cross(secondStart, secondEnd, firstStart);
  const secondSideEnd = cross(secondStart, secondEnd, firstEnd);
  return (
    firstSideStart * firstSideEnd <= GEOMETRY_EPSILON_DEGREES &&
    secondSideStart * secondSideEnd <= GEOMETRY_EPSILON_DEGREES
  );
}

function squaredDistanceBetweenSegments(
  firstStart: AngularPointDegrees,
  firstEnd: AngularPointDegrees,
  secondStart: AngularPointDegrees,
  secondEnd: AngularPointDegrees,
): number {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return 0;
  return Math.min(
    squaredDistanceToSegment(firstStart, secondStart, secondEnd),
    squaredDistanceToSegment(firstEnd, secondStart, secondEnd),
    squaredDistanceToSegment(secondStart, firstStart, firstEnd),
    squaredDistanceToSegment(secondEnd, firstStart, firstEnd),
  );
}

function pointOnPolygonBoundary(
  point: AngularPointDegrees,
  polygon: readonly AngularPointDegrees[],
) {
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length];
    if (
      squaredDistanceToSegment(point, start, end) <=
      GEOMETRY_EPSILON_DEGREES ** 2
    ) {
      return true;
    }
  }
  return false;
}

function pointInUnwrappedPolygon(
  point: AngularPointDegrees,
  polygon: readonly AngularPointDegrees[],
) {
  if (pointOnPolygonBoundary(point, polygon)) return true;
  let inside = false;
  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex++
  ) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    const crossesRay =
      current.altitudeDegrees > point.altitudeDegrees !==
        previous.altitudeDegrees > point.altitudeDegrees &&
      point.azimuthDegrees <
        ((previous.azimuthDegrees - current.azimuthDegrees) *
          (point.altitudeDegrees - current.altitudeDegrees)) /
          (previous.altitudeDegrees - current.altitudeDegrees) +
          current.azimuthDegrees;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function pointInWrappedPolygon(
  point: AngularPointDegrees,
  polygon: readonly AngularPointDegrees[],
  providedReferenceAzimuth?: number,
) {
  if (
    Math.abs(point.altitudeDegrees - 90) <= GEOMETRY_EPSILON_DEGREES &&
    polygon.some(
      (candidate) =>
        Math.abs(candidate.altitudeDegrees - 90) <= GEOMETRY_EPSILON_DEGREES,
    )
  ) {
    return true;
  }
  const referenceAzimuth =
    providedReferenceAzimuth ??
    polygon.reduce((sum, item) => sum + item.azimuthDegrees, 0) /
      polygon.length;
  return pointInUnwrappedPolygon(
    {
      ...point,
      azimuthDegrees: unwrapAzimuthDegreesNear(
        point.azimuthDegrees,
        referenceAzimuth,
      ),
    },
    polygon,
  );
}

function pointInStroke(
  point: AngularPointDegrees,
  stroke: MaskCorrectionOperation,
  providedReferenceAzimuth?: number,
) {
  if (
    Math.abs(point.altitudeDegrees - 90) <= GEOMETRY_EPSILON_DEGREES &&
    stroke.points.some(
      (candidate) =>
        90 - candidate.altitudeDegrees <=
        stroke.angularRadiusDegrees + GEOMETRY_EPSILON_DEGREES,
    )
  ) {
    return true;
  }
  const referenceAzimuth =
    providedReferenceAzimuth ??
    stroke.points.reduce((sum, item) => sum + item.azimuthDegrees, 0) /
      stroke.points.length;
  const unwrappedPoint = {
    ...point,
    azimuthDegrees: unwrapAzimuthDegreesNear(
      point.azimuthDegrees,
      referenceAzimuth,
    ),
  };
  const squaredRadius =
    (stroke.angularRadiusDegrees + GEOMETRY_EPSILON_DEGREES) ** 2;
  if (stroke.points.length === 1) {
    return (
      squaredDistanceToSegment(
        unwrappedPoint,
        stroke.points[0],
        stroke.points[0],
      ) <= squaredRadius
    );
  }
  for (let index = 1; index < stroke.points.length; index += 1) {
    if (
      squaredDistanceToSegment(
        unwrappedPoint,
        stroke.points[index - 1]!,
        stroke.points[index]!,
      ) <= squaredRadius
    ) {
      return true;
    }
  }
  return false;
}

const MASK_BOUNDARY_SCAN_MARGIN_DEGREES = 0.25;

type CompiledPolygon = Readonly<{
  maximumAltitude: number;
  maximumAzimuth: number;
  minimumAltitude: number;
  minimumAzimuth: number;
  points: readonly AngularPointDegrees[];
  referenceAzimuth: number;
}>;

type CompiledStroke = Readonly<{
  maximumAltitude: number;
  maximumAzimuth: number;
  minimumAltitude: number;
  minimumAzimuth: number;
  operation: MaskCorrectionOperation;
  referenceAzimuth: number;
}>;

type BoundaryEdge = Readonly<{
  end: AngularPointDegrees;
  radiusDegrees: number;
  start: AngularPointDegrees;
}>;

export type VisibilityMaskEvaluator = Readonly<{
  classify(point: AngularPointDegrees): MaskClassification;
  segmentMayCrossBoundary(
    left: AngularPointDegrees,
    right: AngularPointDegrees,
  ): boolean;
}>;

const evaluatorCache = new WeakMap<object, VisibilityMaskEvaluator>();

function canonicalizeEvaluationPoint(
  point: AngularPointDegrees,
): AngularPointDegrees {
  if (
    !Number.isFinite(point.azimuthDegrees) ||
    !Number.isFinite(point.altitudeDegrees)
  ) {
    throw new RangeError('Mask coordinates must be finite.');
  }
  if (point.altitudeDegrees < 0 || point.altitudeDegrees > 90) {
    throw new RangeError('Mask altitudeDegrees must be within 0..90.');
  }
  return {
    azimuthDegrees: normalizeAzimuthDegrees(point.azimuthDegrees),
    altitudeDegrees: point.altitudeDegrees,
  };
}

function pointWithinCompiledBounds(
  point: AngularPointDegrees,
  compiled: Pick<
    CompiledPolygon,
    | 'maximumAltitude'
    | 'maximumAzimuth'
    | 'minimumAltitude'
    | 'minimumAzimuth'
    | 'referenceAzimuth'
  >,
): boolean {
  if (
    Math.abs(point.altitudeDegrees - 90) <= GEOMETRY_EPSILON_DEGREES &&
    compiled.maximumAltitude >= 90
  ) {
    return true;
  }
  if (
    point.altitudeDegrees < compiled.minimumAltitude ||
    point.altitudeDegrees > compiled.maximumAltitude
  ) {
    return false;
  }
  const azimuth = unwrapAzimuthDegreesNear(
    point.azimuthDegrees,
    compiled.referenceAzimuth,
  );
  return (
    azimuth >= compiled.minimumAzimuth && azimuth <= compiled.maximumAzimuth
  );
}

function boundsOverlap(
  left: Readonly<{
    minimumAzimuth: number;
    maximumAzimuth: number;
    minimumAltitude: number;
    maximumAltitude: number;
  }>,
  right: Readonly<{
    minimumAzimuth: number;
    maximumAzimuth: number;
    minimumAltitude: number;
    maximumAltitude: number;
  }>,
): boolean {
  return !(
    left.maximumAzimuth < right.minimumAzimuth ||
    right.maximumAzimuth < left.minimumAzimuth ||
    left.maximumAltitude < right.minimumAltitude ||
    right.maximumAltitude < left.minimumAltitude
  );
}

/**
 * Conservatively detects whether a short trajectory segment can encounter any
 * authoritative mask boundary. It is used only to skip needless 0.05-degree
 * subdivision when the segment is demonstrably far from polygon edges and
 * correction strokes; classification changes are always refined separately.
 */
export function createVisibilityMaskEvaluator(
  mask: VisibilityMask,
): VisibilityMaskEvaluator {
  const cached = evaluatorCache.get(mask);
  if (cached) return cached;
  const compilePolygon = (
    points: readonly AngularPointDegrees[],
  ): CompiledPolygon => {
    const referenceAzimuth =
      points.reduce((sum, item) => sum + item.azimuthDegrees, 0) /
      points.length;
    const azimuths = points.map(({ azimuthDegrees }) =>
      unwrapAzimuthDegreesNear(azimuthDegrees, referenceAzimuth),
    );
    const altitudes = points.map(({ altitudeDegrees }) => altitudeDegrees);
    return {
      maximumAltitude: Math.max(...altitudes),
      maximumAzimuth: Math.max(...azimuths),
      minimumAltitude: Math.min(...altitudes),
      minimumAzimuth: Math.min(...azimuths),
      points,
      referenceAzimuth,
    };
  };
  const coverage = mask.coveragePolygons.map(compilePolygon);
  const visiblePolygons = mask.operations
    .filter(
      (operation): operation is VisiblePolygonOperation =>
        operation.kind === 'visiblePolygon',
    )
    .map(({ points }) => compilePolygon(points));
  const strokes = mask.operations
    .filter(
      (operation): operation is MaskCorrectionOperation =>
        operation.kind !== 'visiblePolygon',
    )
    .map((operation): CompiledStroke => {
      const referenceAzimuth =
        operation.points.reduce((sum, item) => sum + item.azimuthDegrees, 0) /
        operation.points.length;
      const azimuths = operation.points.map(({ azimuthDegrees }) =>
        unwrapAzimuthDegreesNear(azimuthDegrees, referenceAzimuth),
      );
      const altitudes = operation.points.map(
        ({ altitudeDegrees }) => altitudeDegrees,
      );
      return {
        maximumAltitude:
          Math.max(...altitudes) + operation.angularRadiusDegrees,
        maximumAzimuth: Math.max(...azimuths) + operation.angularRadiusDegrees,
        minimumAltitude:
          Math.min(...altitudes) - operation.angularRadiusDegrees,
        minimumAzimuth: Math.min(...azimuths) - operation.angularRadiusDegrees,
        operation,
        referenceAzimuth,
      };
    });
  const boundaryEdges: BoundaryEdge[] = [];
  const appendEdges = (
    points: readonly AngularPointDegrees[],
    radiusDegrees: number,
    closed: boolean,
  ) => {
    if (points.length === 1) {
      boundaryEdges.push({
        start: points[0]!,
        end: points[0]!,
        radiusDegrees,
      });
      return;
    }
    const edgeCount = closed ? points.length : points.length - 1;
    for (let index = 0; index < edgeCount; index += 1) {
      boundaryEdges.push({
        start: points[index]!,
        end: points[(index + 1) % points.length]!,
        radiusDegrees,
      });
    }
  };
  mask.coveragePolygons.forEach((points) => appendEdges(points, 0, true));
  mask.operations.forEach((operation) =>
    operation.kind === 'visiblePolygon'
      ? appendEdges(operation.points, 0, true)
      : appendEdges(operation.points, operation.angularRadiusDegrees, false),
  );
  const boundaryBins = Array.from({ length: 36 }, (): BoundaryEdge[] => []);
  let minimumBoundaryAltitude = Number.POSITIVE_INFINITY;
  let maximumBoundaryAltitude = Number.NEGATIVE_INFINITY;
  for (const edge of boundaryEdges) {
    minimumBoundaryAltitude = Math.min(
      minimumBoundaryAltitude,
      edge.start.altitudeDegrees - edge.radiusDegrees,
      edge.end.altitudeDegrees - edge.radiusDegrees,
    );
    maximumBoundaryAltitude = Math.max(
      maximumBoundaryAltitude,
      edge.start.altitudeDegrees + edge.radiusDegrees,
      edge.end.altitudeDegrees + edge.radiusDegrees,
    );
    const endAzimuth = unwrapAzimuthDegreesNear(
      edge.end.azimuthDegrees,
      edge.start.azimuthDegrees,
    );
    const minimumAzimuth =
      Math.min(edge.start.azimuthDegrees, endAzimuth) - edge.radiusDegrees;
    const maximumAzimuth =
      Math.max(edge.start.azimuthDegrees, endAzimuth) + edge.radiusDegrees;
    if (maximumAzimuth - minimumAzimuth >= 360) {
      boundaryBins.forEach((bin) => bin.push(edge));
      continue;
    }
    for (
      let binIndex = Math.floor(minimumAzimuth / 10);
      binIndex <= Math.floor(maximumAzimuth / 10);
      binIndex += 1
    ) {
      boundaryBins[((binIndex % 36) + 36) % 36]!.push(edge);
    }
  }
  const evaluator: VisibilityMaskEvaluator = {
    classify(point) {
      const canonicalPoint = canonicalizeEvaluationPoint(point);
      let withinCoverage = false;
      for (const polygon of coverage) {
        if (
          pointWithinCompiledBounds(canonicalPoint, polygon) &&
          pointInWrappedPolygon(
            canonicalPoint,
            polygon.points,
            polygon.referenceAzimuth,
          )
        ) {
          withinCoverage = true;
          break;
        }
      }
      if (!withinCoverage) {
        return 'blocked';
      }
      let classification: MaskClassification = 'blocked';
      for (const polygon of visiblePolygons) {
        if (
          pointWithinCompiledBounds(canonicalPoint, polygon) &&
          pointInWrappedPolygon(
            canonicalPoint,
            polygon.points,
            polygon.referenceAzimuth,
          )
        ) {
          classification = 'visible';
          break;
        }
      }
      for (const stroke of strokes) {
        if (
          pointWithinCompiledBounds(canonicalPoint, stroke) &&
          pointInStroke(
            canonicalPoint,
            stroke.operation,
            stroke.referenceAzimuth,
          )
        ) {
          classification =
            stroke.operation.kind === 'visibleStroke' ? 'visible' : 'blocked';
        }
      }
      return classification;
    },
    segmentMayCrossBoundary(left, right) {
      const rightAzimuth = unwrapAzimuthDegreesNear(
        right.azimuthDegrees,
        left.azimuthDegrees,
      );
      const segmentCenterAzimuth = (left.azimuthDegrees + rightAzimuth) / 2;
      const segmentBounds = {
        minimumAzimuth:
          Math.min(left.azimuthDegrees, rightAzimuth) -
          MASK_BOUNDARY_SCAN_MARGIN_DEGREES,
        maximumAzimuth:
          Math.max(left.azimuthDegrees, rightAzimuth) +
          MASK_BOUNDARY_SCAN_MARGIN_DEGREES,
        minimumAltitude:
          Math.min(left.altitudeDegrees, right.altitudeDegrees) -
          MASK_BOUNDARY_SCAN_MARGIN_DEGREES,
        maximumAltitude:
          Math.max(left.altitudeDegrees, right.altitudeDegrees) +
          MASK_BOUNDARY_SCAN_MARGIN_DEGREES,
      };
      if (
        segmentBounds.maximumAltitude < minimumBoundaryAltitude ||
        segmentBounds.minimumAltitude > maximumBoundaryAltitude
      ) {
        return false;
      }
      // Azimuth becomes unstable close to the zenith, so segments there need
      // conservative refinement only when the mask actually has a boundary at
      // the same altitude. The altitude rejection above prevents unrelated
      // low-altitude masks from subdividing every near-zenith target to 0.05°.
      if (Math.max(left.altitudeDegrees, right.altitudeDegrees) >= 85) {
        return true;
      }
      const testEdge = ({ end, radiusDegrees, start }: BoundaryEdge) => {
        const startAzimuth = unwrapAzimuthDegreesNear(
          start.azimuthDegrees,
          segmentCenterAzimuth,
        );
        const endAzimuth = unwrapAzimuthDegreesNear(
          end.azimuthDegrees,
          startAzimuth,
        );
        const unwrappedStart = {
          azimuthDegrees: startAzimuth,
          altitudeDegrees: start.altitudeDegrees,
        };
        const unwrappedEnd = {
          azimuthDegrees: endAzimuth,
          altitudeDegrees: end.altitudeDegrees,
        };
        const edgeBounds = {
          minimumAzimuth: Math.min(startAzimuth, endAzimuth) - radiusDegrees,
          maximumAzimuth: Math.max(startAzimuth, endAzimuth) + radiusDegrees,
          minimumAltitude:
            Math.min(start.altitudeDegrees, end.altitudeDegrees) -
            radiusDegrees,
          maximumAltitude:
            Math.max(start.altitudeDegrees, end.altitudeDegrees) +
            radiusDegrees,
        };
        if (!boundsOverlap(segmentBounds, edgeBounds)) return false;
        const refinementRadiusDegrees =
          radiusDegrees + MASK_BOUNDARY_SCAN_MARGIN_DEGREES;
        return (
          squaredDistanceBetweenSegments(
            {
              azimuthDegrees: left.azimuthDegrees,
              altitudeDegrees: left.altitudeDegrees,
            },
            {
              azimuthDegrees: rightAzimuth,
              altitudeDegrees: right.altitudeDegrees,
            },
            unwrappedStart,
            unwrappedEnd,
          ) <=
          refinementRadiusDegrees ** 2
        );
      };
      const firstBinIndex = Math.floor(segmentBounds.minimumAzimuth / 10);
      const lastBinIndex = Math.floor(segmentBounds.maximumAzimuth / 10);
      if (lastBinIndex - firstBinIndex >= 36) {
        return boundaryEdges.some(testEdge);
      }
      for (
        let binIndex = firstBinIndex;
        binIndex <= lastBinIndex;
        binIndex += 1
      ) {
        if (boundaryBins[((binIndex % 36) + 36) % 36]!.some(testEdge)) {
          return true;
        }
      }
      return false;
    },
  };
  evaluatorCache.set(mask, evaluator);
  return evaluator;
}

export function classifyMaskDirection(
  mask: VisibilityMask,
  point: AngularPointDegrees,
): MaskClassification {
  return createVisibilityMaskEvaluator(mask).classify(point);
}

export function maskSegmentMayCrossBoundary(
  mask: VisibilityMask,
  left: AngularPointDegrees,
  right: AngularPointDegrees,
): boolean {
  return createVisibilityMaskEvaluator(mask).segmentMayCrossBoundary(
    left,
    right,
  );
}
