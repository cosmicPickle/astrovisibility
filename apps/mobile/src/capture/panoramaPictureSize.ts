const TARGET_PANORAMA_PICTURE_AREA_PIXELS = 1600 * 1200;
const FOUR_BY_THREE_RATIO = 4 / 3;
const ASPECT_RATIO_TOLERANCE = 0.02;

interface ParsedPictureSize {
  areaPixels: number;
  value: string;
}

const parseFourByThreeSize = (value: string): ParsedPictureSize | null => {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) return null;
  const widthPixels = Number(match[1]);
  const heightPixels = Number(match[2]);
  if (widthPixels <= 0 || heightPixels <= 0) return null;
  const longEdgePixels = Math.max(widthPixels, heightPixels);
  const shortEdgePixels = Math.min(widthPixels, heightPixels);
  if (
    Math.abs(longEdgePixels / shortEdgePixels - FOUR_BY_THREE_RATIO) >
    ASPECT_RATIO_TOLERANCE
  ) {
    return null;
  }
  return { areaPixels: widthPixels * heightPixels, value };
};

export const selectPanoramaPictureSize = (
  availableSizes: readonly string[],
): string | null => {
  const sizes = availableSizes
    .map(parseFourByThreeSize)
    .filter((size): size is ParsedPictureSize => size !== null)
    .sort((left, right) => left.areaPixels - right.areaPixels);
  return (
    sizes
      .filter((size) => size.areaPixels <= TARGET_PANORAMA_PICTURE_AREA_PIXELS)
      .at(-1)?.value ??
    sizes[0]?.value ??
    null
  );
};
