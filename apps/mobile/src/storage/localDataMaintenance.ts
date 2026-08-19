import type { OwnedFileStore, SqlDatabase } from './types';
import { inImmediateTransaction } from './types';

export type MissingFileRecoveryResult = Readonly<{
  discardedDraftTiles: number;
  removedPanoramas: number;
}>;

export type DeleteAllLocalUserDataResult = Readonly<{
  deletedOwnedFileCount: number;
  fileCleanupFailures: readonly string[];
}>;

export async function reconcileMissingOwnedFileReferences(
  database: SqlDatabase,
  files: OwnedFileStore,
): Promise<MissingFileRecoveryResult> {
  const availablePaths = new Set(await files.listOwnedFiles());
  const draftRows = await database.getAllAsync<{
    id: string;
    relativePath: string;
  }>(
    `SELECT id, file_relative_path AS relativePath
     FROM panorama_capture_draft_tiles`,
  );
  const panoramaRows = await database.getAllAsync<{
    panoramaRevisionId: string;
    relativePath: string;
  }>(
    `SELECT panorama_revision_id AS panoramaRevisionId,
      file_relative_path AS relativePath
     FROM panorama_tiles`,
  );
  const missingDraftTileIds = draftRows
    .filter(({ relativePath }) => !availablePaths.has(relativePath))
    .map(({ id }) => id);
  const missingPanoramaIds = new Set(
    panoramaRows
      .filter(({ relativePath }) => !availablePaths.has(relativePath))
      .map(({ panoramaRevisionId }) => panoramaRevisionId),
  );

  if (missingDraftTileIds.length === 0 && missingPanoramaIds.size === 0) {
    return { discardedDraftTiles: 0, removedPanoramas: 0 };
  }

  await inImmediateTransaction(database, async () => {
    for (const tileId of missingDraftTileIds) {
      await database.runAsync(
        'DELETE FROM panorama_capture_draft_tiles WHERE id = ?',
        [tileId],
      );
    }
    for (const panoramaRevisionId of missingPanoramaIds) {
      await database.runAsync(
        `UPDATE profiles SET active_panorama_revision_id = NULL,
          active_mask_revision_id = NULL
         WHERE active_panorama_revision_id = ?`,
        [panoramaRevisionId],
      );
      await database.runAsync('DELETE FROM panorama_revisions WHERE id = ?', [
        panoramaRevisionId,
      ]);
    }
  });

  return {
    discardedDraftTiles: missingDraftTileIds.length,
    removedPanoramas: missingPanoramaIds.size,
  };
}

export async function deleteAllLocalUserData(
  database: SqlDatabase,
  files: OwnedFileStore,
): Promise<DeleteAllLocalUserDataResult> {
  const ownedPaths = await files.listOwnedFiles();
  await inImmediateTransaction(database, async () => {
    await database.runAsync('DELETE FROM profiles');
    await database.runAsync('DELETE FROM equipment_configurations');
    await database.runAsync('DELETE FROM user_settings');
  });
  const cleanup = await Promise.allSettled(
    ownedPaths.map((relativePath) => files.deleteOwnedFile(relativePath)),
  );
  const fileCleanupFailures = ownedPaths.filter(
    (_, index) => cleanup[index]?.status === 'rejected',
  );
  return {
    deletedOwnedFileCount: ownedPaths.length - fileCleanupFailures.length,
    fileCleanupFailures,
  };
}
