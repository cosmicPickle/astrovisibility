import { Directory, File, Paths } from 'expo-file-system';

import type { OwnedFileStore } from './types';

const safeRelativePath = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;
const MAXIMUM_CAPTURE_FILE_BYTES = 32 * 1024 * 1024;

function validateRelativePath(relativePath: string): void {
  if (!safeRelativePath.test(relativePath) || relativePath.includes('\\')) {
    throw new Error('Invalid app-owned relative file path.');
  }
}

export class ExpoOwnedFileStore implements OwnedFileStore {
  private readonly root = new Directory(Paths.document, 'astrovisibility');
  private readonly stagingRoot = new Directory(this.root, '.staging');

  async promoteTemporaryFile(
    sourceUri: string,
    destinationRelativePath: string,
  ): Promise<void> {
    validateRelativePath(destinationRelativePath);
    this.root.create({ idempotent: true, intermediates: true });
    this.stagingRoot.create({ idempotent: true, intermediates: true });

    const destinationSegments = destinationRelativePath.split('/');
    const fileName = destinationSegments.pop();
    if (!fileName) {
      throw new Error('Owned destination must include a file name.');
    }
    const destinationDirectory = new Directory(
      this.root,
      ...destinationSegments,
    );
    destinationDirectory.create({ idempotent: true, intermediates: true });
    const destination = new File(destinationDirectory, fileName);
    const staging = new File(
      this.stagingRoot,
      `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`,
    );
    const source = new File(sourceUri);
    if (!source.exists) {
      throw new Error('Temporary capture file is unavailable.');
    }
    if (source.size > MAXIMUM_CAPTURE_FILE_BYTES) {
      throw new Error('Capture file exceeds the 32 MB local-storage limit.');
    }
    try {
      await source.copy(staging, { overwrite: false });
      await staging.move(destination, { overwrite: false });
      source.delete();
    } catch (error) {
      if (staging.exists) {
        staging.delete();
      }
      throw error;
    }
  }

  async deleteOwnedFile(relativePath: string): Promise<void> {
    validateRelativePath(relativePath);
    const file = new File(this.root, ...relativePath.split('/'));
    if (file.exists) {
      file.delete();
    }
  }

  async copyOwnedFile(
    sourceRelativePath: string,
    destinationRelativePath: string,
  ): Promise<void> {
    validateRelativePath(sourceRelativePath);
    validateRelativePath(destinationRelativePath);
    const source = new File(this.root, ...sourceRelativePath.split('/'));
    if (!source.exists) {
      throw new Error('App-local capture file is unavailable.');
    }
    const destinationSegments = destinationRelativePath.split('/');
    const fileName = destinationSegments.pop();
    if (!fileName)
      throw new Error('Owned destination must include a file name.');
    const destinationDirectory = new Directory(
      this.root,
      ...destinationSegments,
    );
    destinationDirectory.create({ idempotent: true, intermediates: true });
    await source.copy(new File(destinationDirectory, fileName), {
      overwrite: false,
    });
  }

  resolveOwnedFileUri(relativePath: string): string {
    validateRelativePath(relativePath);
    return new File(this.root, ...relativePath.split('/')).uri;
  }

  async listOwnedFiles(): Promise<string[]> {
    const profiles = new Directory(this.root, 'profiles');
    if (!profiles.exists) {
      return [];
    }
    return this.listFilesRecursively(profiles, 'profiles');
  }

  clearStagingFiles(): void {
    if (this.stagingRoot.exists) {
      this.stagingRoot.delete();
    }
    this.stagingRoot.create({ idempotent: true, intermediates: true });
  }

  private listFilesRecursively(directory: Directory, prefix: string): string[] {
    return directory.list().flatMap((entry) => {
      const relativePath = `${prefix}/${entry.name}`;
      return entry instanceof Directory
        ? this.listFilesRecursively(entry, relativePath)
        : [relativePath];
    });
  }
}
