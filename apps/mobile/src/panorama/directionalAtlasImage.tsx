import {
  AlphaType,
  BlendMode,
  ColorType,
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  TileMode,
  VertexMode,
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

interface DisposableResource {
  dispose(): void;
}

export async function processResourcesSequentially<
  Input,
  Resource extends DisposableResource,
>(
  inputs: readonly Input[],
  load: (input: Input) => Promise<Resource>,
  process: (resource: Resource, input: Input) => Promise<void> | void,
): Promise<void> {
  for (const input of inputs) {
    const resource = await load(input);
    try {
      await process(resource, input);
    } finally {
      resource.dispose();
    }
  }
}

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
  const size = {
    heightPixels: DIRECTIONAL_ATLAS_SIZE_PIXELS,
    widthPixels: DIRECTIONAL_ATLAS_SIZE_PIXELS,
  };
  const surface = Skia.Surface.Make(size.widthPixels, size.heightPixels);
  if (!surface)
    throw new Error('The directional panorama surface could not be created.');
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    await processResourcesSequentially(
      draft.tiles,
      (tile) => loadImage(tile.uri),
      (tileImage, draftTile) => {
        const tile = asPanoramaTile(draftTile);
        const mesh = createPlanetariumPanoramaMesh(tile);
        const shader = tileImage.makeShaderOptions(
          TileMode.Decal,
          TileMode.Decal,
          FilterMode.Linear,
          MipmapMode.None,
        );
        const paint = Skia.Paint();
        paint.setAntiAlias(true);
        paint.setShader(shader);
        const vertices = Skia.MakeVertices(
          VertexMode.Triangles,
          mesh.directions.map((direction) => {
            const point = directionToAtlasPixel(direction, size);
            return Skia.Point(point.xPixels, point.yPixels);
          }),
          mesh.texturePointsPixels.map(({ x, y }) => Skia.Point(x, y)),
          undefined,
          mesh.indices,
        );
        try {
          canvas.drawVertices(vertices, BlendMode.SrcOver, paint);
          surface.flush();
        } finally {
          vertices.dispose();
          paint.dispose();
          shader.dispose();
        }
      },
    );
    surface.flush();
    const rgba = canvas.readPixels(0, 0, {
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
      height: size.heightPixels,
      width: size.widthPixels,
    });
    if (!(rgba instanceof Uint8Array))
      throw new Error('The panorama coverage could not be read.');
    const image = surface.makeImageSnapshot();
    const temporary = new File(
      Paths.cache,
      `astrovisibility-panorama-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
    );
    try {
      temporary.write(image.encodeToBytes(ImageFormat.PNG, 100));
    } finally {
      image.dispose();
    }
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
  } finally {
    surface.dispose();
  }
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
