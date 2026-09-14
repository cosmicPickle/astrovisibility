import { requireOptionalNativeModule } from 'expo';
import { File } from 'expo-file-system';

import { bootstrapStorage } from '../storage/bootstrapStorage';
import type {
  ActivePanorama,
  CompletedPanoramaAsset,
} from '../storage/panoramaDraftRepository';
import { createLocalRecordId } from '../storage/recordIdentity';
import {
  DIRECTIONAL_ATLAS_PROJECTION,
  DIRECTIONAL_ATLAS_SIZE_PIXELS,
} from './directionalAtlas';

export interface StitchingProgress {
  stage: 'reading' | 'matching' | 'aligning' | 'seams' | 'blending' | 'writing';
  completed: number;
  total: number;
}
interface NativeStitching {
  licences(): Promise<string>;
  clearCache(): Promise<void>;
  stitch(
    jobId: string,
    tiles: string,
  ): Promise<{ uri: string; coverageUri: string; unmatchedCount: number }>;
  cancel(jobId: string): void;
  discard(jobId: string): Promise<void>;
  addListener(
    event: 'onProgress',
    listener: (event: StitchingProgress & { jobId: string }) => void,
  ): { remove(): void };
}
export interface StitchedPreview {
  jobId: string;
  draftId: string;
  asset: CompletedPanoramaAsset;
  panorama: ActivePanorama;
  centerAzimuthDegrees: number;
  centerAltitudeDegrees: number;
  unmatchedCount: number;
}
export interface StitchingController {
  create(
    profileId: string,
    signal: AbortSignal,
    progress: (value: StitchingProgress) => void,
  ): Promise<StitchedPreview>;
  save(preview: StitchedPreview): Promise<void>;
  discard(preview: StitchedPreview): Promise<void>;
}

const nativeModule = () => {
  const native = requireOptionalNativeModule<NativeStitching>(
    'AstrovisibilityPanorama',
  );
  if (!native) throw new Error('Automatic stitching requires the Android app.');
  return native;
};

export const readPanoramaLicences = () => nativeModule().licences();
export async function clearPanoramaStitchingCache(): Promise<void> {
  await requireOptionalNativeModule<NativeStitching>(
    'AstrovisibilityPanorama',
  )?.clearCache();
}

export const panoramaStitchingController: StitchingController = {
  async create(profileId, signal, progress) {
    const native = nativeModule();
    const storage = await bootstrapStorage();
    const draft = await storage.panoramas.getForProfile(profileId);
    if (!draft?.tiles.length)
      throw new Error('Capture at least one photo first.');
    if (signal.aborted) throw new Error('Cancelled');
    const jobId = createLocalRecordId('panorama');
    const cancel = () => native.cancel(jobId);
    signal.addEventListener('abort', cancel);
    const subscription = native.addListener('onProgress', (event) => {
      if (event.jobId === jobId && !signal.aborted) progress(event);
    });
    try {
      const result = await native.stitch(
        jobId,
        JSON.stringify(
          draft.tiles.map(({ uri, reviewedPlacement }) => ({
            uri,
            reviewedPlacement,
          })),
        ),
      );
      if (signal.aborted) throw new Error('Cancelled');
      const coverageBitset = await new File(result.coverageUri).bytes();
      const size = DIRECTIONAL_ATLAS_SIZE_PIXELS;
      if (coverageBitset.length !== (size * size) / 8)
        throw new Error('Invalid panorama coverage');
      const asset: CompletedPanoramaAsset = {
        temporaryUri: result.uri,
        coverageBitset,
        projection: DIRECTIONAL_ATLAS_PROJECTION,
        widthPixels: size,
        heightPixels: size,
      };
      const anchor = draft.tiles[0].reviewedPlacement;
      return {
        jobId,
        draftId: draft.id,
        asset,
        unmatchedCount: result.unmatchedCount,
        centerAzimuthDegrees: anchor.centerAzimuthDegrees,
        centerAltitudeDegrees: anchor.centerAltitudeDegrees,
        panorama: {
          id: jobId,
          profileId,
          tiles: [],
          ...asset,
          uri: asset.temporaryUri,
        },
      };
    } catch (error) {
      await native.discard(jobId);
      throw error;
    } finally {
      signal.removeEventListener('abort', cancel);
      subscription.remove();
    }
  },
  async save(preview) {
    const storage = await bootstrapStorage();
    // Promotion consumes its input. Keep the preview intact for transaction
    // failure/retry by giving the existing repository a separate staging copy.
    const source = new File(preview.asset.temporaryUri);
    const staging = new File(
      source.parentDirectory,
      `${createLocalRecordId('panorama')}.png`,
    );
    try {
      await source.copy(staging, { overwrite: false });
      await storage.panoramas.complete(
        preview.draftId,
        createLocalRecordId('panorama'),
        new Date().toISOString(),
        {
          ...preview.asset,
          temporaryUri: staging.uri,
        },
      );
    } finally {
      if (staging.exists) staging.delete();
    }
  },
  async discard(preview) {
    await nativeModule().discard(preview.jobId);
  },
};
