import catalogueArtifact from '../catalogue/generated/catalogue.json';
import licenceManifest from '../catalogue/generated/licence-manifest.json';
import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter.ts';
import { CatalogueRepository } from './catalogueRepository';
import { seedCatalogue } from './catalogueSeed';
import { openAstrovisibilityDatabase } from './database';
import { ExpoOwnedFileStore } from './expoOwnedFileStore';
import { EquipmentRepository } from './equipmentRepository';
import { MaskRepository } from './maskRepository';
import { reconcileMissingOwnedFileReferences } from './localDataMaintenance';
import { PanoramaDraftRepository } from './panoramaDraftRepository';
import { removeOrphanedOwnedFiles } from './panoramaPersistence';
import { ProfileRepository } from './profileRepository';
import type { SqlDatabase } from './types';

const catalogue = catalogueArtifact as {
  dataVersion: string;
  targets: CatalogueTarget[];
};

export interface AppStorage {
  catalogue: CatalogueRepository;
  database: SqlDatabase;
  equipment: EquipmentRepository;
  files: ExpoOwnedFileStore;
  masks: MaskRepository;
  panoramas: PanoramaDraftRepository;
  profiles: ProfileRepository;
}

let storagePromise: Promise<AppStorage> | null = null;

async function initializeStorage(): Promise<AppStorage> {
  const database = await openAstrovisibilityDatabase();
  const fileStore = new ExpoOwnedFileStore();
  fileStore.clearStagingFiles();
  await reconcileMissingOwnedFileReferences(database, fileStore);
  await removeOrphanedOwnedFiles(database, fileStore);
  await seedCatalogue(
    database,
    catalogue.targets,
    catalogue.dataVersion,
    licenceManifest.outputSha256,
  );
  return {
    catalogue: new CatalogueRepository(database),
    database,
    equipment: new EquipmentRepository(database),
    files: fileStore,
    masks: new MaskRepository(database, fileStore),
    panoramas: new PanoramaDraftRepository(database, fileStore),
    profiles: new ProfileRepository(database),
  };
}

export async function maintainStorage(storage: AppStorage): Promise<void> {
  storage.files.clearStagingFiles();
  await reconcileMissingOwnedFileReferences(storage.database, storage.files);
  await removeOrphanedOwnedFiles(storage.database, storage.files);
}

export function bootstrapStorage(): Promise<AppStorage> {
  if (!storagePromise) {
    storagePromise = initializeStorage().catch((error: unknown) => {
      storagePromise = null;
      throw error;
    });
  }
  return storagePromise;
}
