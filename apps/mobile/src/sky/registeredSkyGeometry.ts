export interface EquatorialDirection {
  declinationJ2000Degrees: number;
  rightAscensionJ2000Hours: number;
}

export interface EquatorialImageMesh {
  columnCount: number;
  directions: EquatorialDirection[];
  indices: number[];
  rowCount: number;
  texturePointsPixels: { x: number; y: number }[];
}

const assertPositivePixels = (value: number, name: string) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
};

const wrapRightAscensionHours = (hours: number) => ((hours % 24) + 24) % 24;

const createGridIndices = (columnCount: number, rowCount: number) => {
  const indices: number[] = [];
  for (let row = 0; row < rowCount - 1; row += 1) {
    for (let column = 0; column < columnCount - 1; column += 1) {
      const topLeft = row * columnCount + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columnCount;
      const bottomRight = bottomLeft + 1;
      indices.push(
        topLeft,
        topRight,
        bottomRight,
        topLeft,
        bottomRight,
        bottomLeft,
      );
    }
  }
  return indices;
};

export const createEquatorialAtlasTiles = (input: {
  heightPixels: number;
  widthPixels: number;
}): EquatorialImageMesh[] => {
  assertPositivePixels(input.widthPixels, 'widthPixels');
  assertPositivePixels(input.heightPixels, 'heightPixels');
  const longitudeTileCount = 12;
  const latitudeTileCount = 6;
  const pointCountPerAxis = 7;
  const tiles: EquatorialImageMesh[] = [];
  for (
    let latitudeTile = 0;
    latitudeTile < latitudeTileCount;
    latitudeTile += 1
  ) {
    for (
      let longitudeTile = 0;
      longitudeTile < longitudeTileCount;
      longitudeTile += 1
    ) {
      const directions: EquatorialDirection[] = [];
      const texturePointsPixels: { x: number; y: number }[] = [];
      for (let row = 0; row < pointCountPerAxis; row += 1) {
        const verticalTileRatio = row / (pointCountPerAxis - 1);
        const globalVerticalRatio =
          (latitudeTile + verticalTileRatio) / latitudeTileCount;
        for (let column = 0; column < pointCountPerAxis; column += 1) {
          const horizontalTileRatio = column / (pointCountPerAxis - 1);
          const globalHorizontalRatio =
            (longitudeTile + horizontalTileRatio) / longitudeTileCount;
          directions.push({
            declinationJ2000Degrees: 90 - globalVerticalRatio * 180,
            rightAscensionJ2000Hours: wrapRightAscensionHours(
              globalHorizontalRatio * 24,
            ),
          });
          texturePointsPixels.push({
            x: globalHorizontalRatio * input.widthPixels,
            y: globalVerticalRatio * input.heightPixels,
          });
        }
      }
      tiles.push({
        columnCount: pointCountPerAxis,
        directions,
        indices: createGridIndices(pointCountPerAxis, pointCountPerAxis),
        rowCount: pointCountPerAxis,
        texturePointsPixels,
      });
    }
  }
  return tiles;
};

const equatorialVector = (
  rightAscensionRadians: number,
  declinationRadians: number,
) => ({
  x: Math.cos(declinationRadians) * Math.cos(rightAscensionRadians),
  y: Math.cos(declinationRadians) * Math.sin(rightAscensionRadians),
  z: Math.sin(declinationRadians),
});

export const createEquatorialCutoutMesh = (input: {
  centerDeclinationJ2000Degrees: number;
  centerRightAscensionJ2000Hours: number;
  fieldOfViewDegrees: number;
  heightPixels: number;
  widthPixels: number;
}): EquatorialImageMesh => {
  assertPositivePixels(input.widthPixels, 'widthPixels');
  assertPositivePixels(input.heightPixels, 'heightPixels');
  if (
    !Number.isFinite(input.fieldOfViewDegrees) ||
    input.fieldOfViewDegrees <= 0 ||
    input.fieldOfViewDegrees > 180
  ) {
    throw new RangeError(
      'fieldOfViewDegrees must be greater than 0 and at most 180',
    );
  }
  if (
    input.centerRightAscensionJ2000Hours < 0 ||
    input.centerRightAscensionJ2000Hours >= 24
  ) {
    throw new RangeError('centerRightAscensionJ2000Hours must be 0..<24');
  }
  if (
    input.centerDeclinationJ2000Degrees < -90 ||
    input.centerDeclinationJ2000Degrees > 90
  ) {
    throw new RangeError('centerDeclinationJ2000Degrees must be -90..90');
  }

  const pointCountPerAxis = 5;
  const degreesToRadians = Math.PI / 180;
  const centerRightAscensionRadians =
    input.centerRightAscensionJ2000Hours * 15 * degreesToRadians;
  const centerDeclinationRadians =
    input.centerDeclinationJ2000Degrees * degreesToRadians;
  const center = equatorialVector(
    centerRightAscensionRadians,
    centerDeclinationRadians,
  );
  const east = {
    x: -Math.sin(centerRightAscensionRadians),
    y: Math.cos(centerRightAscensionRadians),
    z: 0,
  };
  const north = {
    x:
      -Math.sin(centerDeclinationRadians) *
      Math.cos(centerRightAscensionRadians),
    y:
      -Math.sin(centerDeclinationRadians) *
      Math.sin(centerRightAscensionRadians),
    z: Math.cos(centerDeclinationRadians),
  };
  const halfFieldTangent = Math.tan(
    (input.fieldOfViewDegrees * degreesToRadians) / 2,
  );
  const directions: EquatorialDirection[] = [];
  const texturePointsPixels: { x: number; y: number }[] = [];
  for (let row = 0; row < pointCountPerAxis; row += 1) {
    const verticalRatio = row / (pointCountPerAxis - 1);
    for (let column = 0; column < pointCountPerAxis; column += 1) {
      const horizontalRatio = column / (pointCountPerAxis - 1);
      const eastOffset = (1 - horizontalRatio * 2) * halfFieldTangent;
      const northOffset = (1 - verticalRatio * 2) * halfFieldTangent;
      const x = center.x + east.x * eastOffset + north.x * northOffset;
      const y = center.y + east.y * eastOffset + north.y * northOffset;
      const z = center.z + east.z * eastOffset + north.z * northOffset;
      const length = Math.hypot(x, y, z);
      directions.push({
        declinationJ2000Degrees: Math.asin(z / length) / degreesToRadians,
        rightAscensionJ2000Hours: wrapRightAscensionHours(
          Math.atan2(y, x) / degreesToRadians / 15,
        ),
      });
      texturePointsPixels.push({
        x: horizontalRatio * input.widthPixels,
        y: verticalRatio * input.heightPixels,
      });
    }
  }
  return {
    columnCount: pointCountPerAxis,
    directions,
    indices: createGridIndices(pointCountPerAxis, pointCountPerAxis),
    rowCount: pointCountPerAxis,
    texturePointsPixels,
  };
};
