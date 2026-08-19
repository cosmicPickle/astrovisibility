/** @jest-environment node */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { buildCatalogueArtifacts } from './catalogueImporter.ts';

const sourceDirectory = path.join(__dirname, 'source');

describe('OpenNGC catalogue importer', () => {
  it('imports every required catalogue membership without alias duplicates', async () => {
    const result = await buildCatalogueArtifacts(sourceDirectory);

    expect(
      new Set(result.catalogue.targets.map((target) => target.id)).size,
    ).toBe(result.catalogue.targets.length);
    expect(result.report.catalogueMemberships.caldwell).toBe(109);
    expect(result.report.distinctMembershipNumbers.caldwell).toEqual(
      Array.from({ length: 109 }, (_, index) => index + 1),
    );
    expect(result.report.distinctMembershipNumbers.messier).toEqual(
      Array.from({ length: 110 }, (_, index) => index + 1),
    );
    expect(result.report.unresolvedDuplicateAliases).toEqual([]);
    expect(result.report.unresolvedCaldwellSourceNames).toEqual([]);

    const andromeda = result.catalogue.targets.find((target) =>
      target.aliases.includes('M 31'),
    );
    expect(andromeda).toMatchObject({
      id: 'NGC0224',
      preferredName: 'Andromeda Galaxy',
      memberships: { messier: [31] },
    });

    const doubleCluster = result.catalogue.targets.find(
      (target) => target.memberships.caldwell === 14,
    );
    expect(doubleCluster?.aliases).toEqual(
      expect.arrayContaining(['C 14', 'NGC 869', 'NGC 884']),
    );
  });

  it('emits byte-for-byte deterministic compact data and provenance', async () => {
    const first = await buildCatalogueArtifacts(sourceDirectory);
    const second = await buildCatalogueArtifacts(sourceDirectory);

    expect(first.serialized).toEqual(second.serialized);
    expect(first.serialized.catalogue.endsWith('\n')).toBe(true);
    expect(first.manifest.sources[0]).toMatchObject({
      release: 'v20260501',
      commit: '36cb178a0f69dba8bfc03a99c10512831edf1c6b',
      license: 'CC BY-SA 4.0',
    });
    expect(first.manifest.sources[1].attribution).toBe(
      'Astronomical League and Sir Patrick Moore',
    );
    expect(first.manifest.outputSha256).toBe(
      createHash('sha256').update(first.serialized.catalogue).digest('hex'),
    );

    const licence = await readFile(
      path.join(sourceDirectory, 'OPENNGC-CC-BY-SA-4.0.txt'),
      'utf8',
    );
    expect(licence).toContain('Creative Commons Attribution-ShareAlike 4.0');
  });
});
