import { File } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo';
import {
  createPlanetariumProjectionContext,
  type PlanetariumCamera,
} from '../sky/planetariumProjection';
import type { CanvasSizePixels } from '../sky/projection';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';

export type MaskPaintMode = 'manual' | 'magic';
export interface MaskBrushStroke {
  brushDiameterPixels: number;
  camera: PlanetariumCamera;
  canvas: CanvasSizePixels;
  mode: MaskPaintMode;
  points: readonly { xPixels: number; yPixels: number }[];
}

export function createMaskBrushRequest(stroke: MaskBrushStroke) {
  if (stroke.points.length > 4096)
    throw new RangeError('Use a shorter stroke.');
  const { camera, canvas } = stroke;
  return {
    mode: stroke.mode,
    points: stroke.points.map(({ xPixels, yPixels }) => [xPixels, yPixels]),
    radius: stroke.brushDiameterPixels / 2,
    view: [
      canvas.widthPixels,
      canvas.heightPixels,
      createPlanetariumProjectionContext(camera, canvas).projectionScalePixels,
      camera.right.x,
      camera.right.y,
      camera.right.z,
      camera.up.x,
      camera.up.y,
      camera.up.z,
      camera.forward.x,
      camera.forward.y,
      camera.forward.z,
    ],
  };
}

/** Bitwise updates retain chronology and make uncaptured sky unconditionally blocked. */
export function applyMaskSelection(
  blocked: Uint8Array,
  coverage: Uint8Array,
  selection: Uint8Array,
  draw: boolean,
) {
  if (blocked.length !== coverage.length || blocked.length !== selection.length)
    throw new RangeError('Mask selection dimensions disagree.');
  const result = new Uint8Array(blocked.length);
  for (let index = 0; index < result.length; index++) {
    const edited = draw
      ? blocked[index]! | selection[index]!
      : blocked[index]! & ~selection[index]!;
    result[index] = edited | ~coverage[index]!;
  }
  return result;
}

interface NativeMaskEditing {
  begin(session: string): void;
  select(
    session: string,
    uri: string,
    width: number,
    height: number,
    request: string,
  ): Promise<string>;
  end(session: string): Promise<void>;
}

export function createMaskSelectionSession() {
  const native = requireOptionalNativeModule<NativeMaskEditing>(
    'AstrovisibilityMaskEditing',
  );
  if (!native)
    throw new Error('Mask painting requires the updated Android app.');
  const id = `mask-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let active = true;
  native.begin(id);
  return {
    async select(panorama: ActivePanorama, stroke: MaskBrushStroke) {
      if (
        !active ||
        !panorama.uri ||
        !panorama.widthPixels ||
        !panorama.heightPixels
      )
        throw new Error('Mask editor is unavailable.');
      const uri = await native.select(
        id,
        panorama.uri,
        panorama.widthPixels,
        panorama.heightPixels,
        JSON.stringify(createMaskBrushRequest(stroke)),
      );
      const file = new File(uri);
      try {
        if (!active) throw new Error('Mask editing was cancelled.');
        const expected = Math.ceil(
          (panorama.widthPixels * panorama.heightPixels) / 8,
        );
        if (file.size !== expected)
          throw new Error('Mask selection dimensions disagree.');
        const result = await file.bytes();
        if (!active || result.length !== expected)
          throw new Error('Mask selection is unavailable.');
        return result;
      } finally {
        if (file.exists) file.delete();
      }
    },
    close() {
      active = false;
      void native.end(id).catch(() => undefined);
    },
  };
}
