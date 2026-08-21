import {
  AlphaType,
  ColorType,
  drawAsImage,
  Group,
  ImageFormat,
  ImageShader,
  Skia,
  Vertices,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import type { PanoramaCaptureDraft } from '../storage/panoramaDraftRepository';
import { createCoverageBitsetFromRgba } from '../mask/rasterMask';
import { createPlanetariumPanoramaMesh } from '../sky/planetariumPanoramaGeometry';
import {
  DIRECTIONAL_ATLAS_PROJECTION,
  DIRECTIONAL_ATLAS_SIZE_PIXELS,
  directionToAtlasPixel,
} from './directionalAtlas';

export interface DirectionalAtlasImageResult {
  coverageBitset: Uint8Array;
  heightPixels: number;
  projection: typeof DIRECTIONAL_ATLAS_PROJECTION;
  temporaryUri: string;
  widthPixels: number;
}

const loadImage = async (uri: string): Promise<SkImage> => {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('A captured tile could not be decoded.');
  return image;
};

const asPanoramaTile = (tile: PanoramaCaptureDraft['tiles'][number]) => ({
  id: tile.id,
  uri: tile.uri,
  widthPixels: tile.widthPixels,
  heightPixels: tile.heightPixels,
  centerAzimuthDegrees: tile.reviewedPlacement.centerAzimuthDegrees,
  centerAltitudeDegrees: tile.reviewedPlacement.centerAltitudeDegrees,
  rollDegrees: tile.reviewedPlacement.rollDegrees,
  horizontalFieldOfViewDegrees:
    tile.reviewedPlacement.horizontalFieldOfViewDegrees,
  verticalFieldOfViewDegrees: tile.reviewedPlacement.verticalFieldOfViewDegrees,
  coveragePolygon: tile.coveragePolygon,
});

export async function createDirectionalPanoramaImage(
  draft: PanoramaCaptureDraft,
): Promise<DirectionalAtlasImageResult> {
  if (draft.tiles.length === 0)
    throw new Error('Capture at least one tile before creating a panorama.');
  const loadedTiles = await Promise.all(
    draft.tiles.map(async (draftTile) => {
      const tile = asPanoramaTile(draftTile);
      return {
        image: await loadImage(tile.uri),
        mesh: createPlanetariumPanoramaMesh(tile),
        tile,
      };
    }),
  );
  const size = {
    heightPixels: DIRECTIONAL_ATLAS_SIZE_PIXELS,
    widthPixels: DIRECTIONAL_ATLAS_SIZE_PIXELS,
  };
  const image = await drawAsImage(
    <Group>
      {loadedTiles.map(({ image: tileImage, mesh, tile }) => (
        <Group key={tile.id}>
          <ImageShader image={tileImage} tx="decal" ty="decal" />
          <Vertices
            indices={mesh.indices}
            mode="triangles"
            textures={mesh.texturePointsPixels.map(({ x, y }) => vec(x, y))}
            vertices={mesh.directions.map((direction) => {
              const point = directionToAtlasPixel(direction, size);
              return vec(point.xPixels, point.yPixels);
            })}
          />
        </Group>
      ))}
    </Group>,
    { height: size.heightPixels, width: size.widthPixels },
  );
  if (!image)
    throw new Error('The directional panorama could not be rasterized.');
  const rgba = image.readPixels(0, 0, {
    alphaType: AlphaType.Unpremul,
    colorType: ColorType.RGBA_8888,
    height: size.heightPixels,
    width: size.widthPixels,
  });
  if (!(rgba instanceof Uint8Array))
    throw new Error('The panorama coverage could not be read.');
  const temporary = new File(
    Paths.cache,
    `astrovisibility-panorama-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  );
  temporary.write(image.encodeToBytes(ImageFormat.PNG, 100));
  loadedTiles.forEach(({ image: tileImage }) => tileImage.dispose());
  image.dispose();
  return {
    coverageBitset: createCoverageBitsetFromRgba(
      rgba,
      size.widthPixels,
      size.heightPixels,
    ),
    heightPixels: size.heightPixels,
    projection: DIRECTIONAL_ATLAS_PROJECTION,
    temporaryUri: temporary.uri,
    widthPixels: size.widthPixels,
  };
}

export function createMaskImageFile(
  rgbaPixels: Uint8Array,
  widthPixels: number,
  heightPixels: number,
): string {
  const data = Skia.Data.fromBytes(rgbaPixels);
  const image = Skia.Image.MakeImage(
    {
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
      height: heightPixels,
      width: widthPixels,
    },
    data,
    widthPixels * 4,
  );
  if (!image) throw new Error('The binary mask image could not be created.');
  const temporary = new File(
    Paths.cache,
    `astrovisibility-mask-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  );
  temporary.write(image.encodeToBytes(ImageFormat.PNG, 100));
  image.dispose();
  data.dispose();
  return temporary.uri;
}
