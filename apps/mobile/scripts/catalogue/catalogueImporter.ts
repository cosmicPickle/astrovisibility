import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const OPEN_NGC_RELEASE = 'v20260501';
const OPEN_NGC_COMMIT = '36cb178a0f69dba8bfc03a99c10512831edf1c6b';
const TRANSFORM_VERSION = 1;

type CsvRow = Record<string, string>;

export interface CatalogueTarget {
  id: string;
  preferredName: string;
  aliases: string[];
  rightAscensionJ2000Hours: number;
  declinationJ2000Degrees: number;
  constellation: string;
  objectType: string;
  majorAxisArcminutes?: number;
  minorAxisArcminutes?: number;
  positionAngleDegrees?: number;
  magnitude?: number;
  memberships: {
    messier: number[];
    ngc: string[];
    ic: string[];
    caldwell?: number;
  };
  prominenceTier: 1 | 2 | 3 | 4;
}

interface MutableTarget extends Omit<
  CatalogueTarget,
  'aliases' | 'memberships'
> {
  aliases: Set<string>;
  memberships: {
    messier: Set<number>;
    ngc: Set<string>;
    ic: Set<string>;
    caldwell?: number;
  };
}

interface CaldwellMapping {
  caldwellNumber: number;
  sourceName: string;
  additionalAliases: string[];
}

export interface CatalogueArtifacts {
  catalogue: {
    formatVersion: 1;
    dataVersion: string;
    targets: CatalogueTarget[];
  };
  report: {
    sourceRows: number;
    runtimeTargets: number;
    excludedNonexistentRows: number;
    resolvedDuplicateAliases: number;
    unresolvedDuplicateAliases: string[];
    unresolvedCaldwellSourceNames: string[];
    catalogueMemberships: {
      messier: number;
      ngc: number;
      ic: number;
      caldwell: number;
    };
    distinctMembershipNumbers: {
      messier: number[];
      caldwell: number[];
    };
  };
  manifest: {
    formatVersion: 1;
    dataVersion: string;
    transformVersion: number;
    generatedFromPinnedInputsOn: string;
    sources: Array<{
      name: string;
      url: string;
      release: string;
      commit: string;
      license: string;
      attribution: string;
    }>;
    outputSha256: string;
  };
  serialized: {
    catalogue: string;
    report: string;
    manifest: string;
  };
}

function parseDelimited(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        currentField += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        currentField += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      currentRow.push(currentField);
      currentField = '';
    } else if (character === '\n') {
      currentRow.push(currentField.replace(/\r$/, ''));
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += character;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.replace(/\r$/, ''));
    rows.push(currentRow);
  }
  if (quoted) {
    throw new Error('Unterminated quoted field in catalogue input.');
  }
  return rows;
}

function parseCsvObjects(text: string, delimiter = ';'): CsvRow[] {
  const [header, ...dataRows] = parseDelimited(text, delimiter);
  if (!header) {
    throw new Error('Catalogue input is empty.');
  }
  return dataRows
    .filter((row) => row.some((field) => field.length > 0))
    .map((row) =>
      Object.fromEntries(
        header.map((column, index) => [column, row[index] ?? '']),
      ),
    );
}

function parseRightAscensionHours(value: string): number {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  const result = hours + minutes / 60 + seconds / 3600;
  if (!Number.isFinite(result) || result < 0 || result >= 24) {
    throw new Error(`Invalid J2000 right ascension: ${value}`);
  }
  return result;
}

function parseDeclinationDegrees(value: string): number {
  const match = /^([+-])(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value);
  if (!match) {
    throw new Error(`Invalid J2000 declination: ${value}`);
  }
  const sign = match[1] === '-' ? -1 : 1;
  const result =
    sign * (Number(match[2]) + Number(match[3]) / 60 + Number(match[4]) / 3600);
  if (!Number.isFinite(result) || result < -90 || result > 90) {
    throw new Error(`Invalid J2000 declination: ${value}`);
  }
  return result;
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function displayCatalogueName(value: string): string {
  const match = /^(NGC|IC|M|C)(\d+)(.*)$/.exec(value);
  if (!match) {
    return value.replace(/\s+/g, ' ').trim();
  }
  return `${match[1]} ${Number(match[2])}${match[3]}`.trim();
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function addNumericMembership(
  target: MutableTarget,
  kind: 'messier',
  value: string,
): void {
  if (value.trim() !== '') {
    target.memberships[kind].add(Number(value));
    target.aliases.add(`M ${Number(value)}`);
  }
}

function addCatalogueMemberships(target: MutableTarget, row: CsvRow): void {
  if (/^NGC\d/.test(row.Name)) {
    target.memberships.ngc.add(displayCatalogueName(row.Name));
  }
  if (/^IC\d/.test(row.Name)) {
    target.memberships.ic.add(displayCatalogueName(row.Name));
  }
  for (const number of splitList(row.NGC)) {
    target.memberships.ngc.add(`NGC ${Number(number)}`);
    target.aliases.add(`NGC ${Number(number)}`);
  }
  for (const number of splitList(row.IC)) {
    target.memberships.ic.add(`IC ${Number(number)}`);
    target.aliases.add(`IC ${Number(number)}`);
  }
  addNumericMembership(target, 'messier', row.M);
}

function determineProminenceTier(
  row: CsvRow,
  hasCommonName: boolean,
): 1 | 2 | 3 | 4 {
  const magnitude =
    optionalNumber(row['V-Mag']) ?? optionalNumber(row['B-Mag']);
  if (row.M || hasCommonName || (magnitude !== undefined && magnitude <= 6)) {
    return 1;
  }
  if (magnitude !== undefined && magnitude <= 9) {
    return 2;
  }
  if (magnitude !== undefined && magnitude <= 12) {
    return 3;
  }
  return 4;
}

function createTarget(row: CsvRow): MutableTarget {
  const commonNames = splitList(row['Common names']);
  const target: MutableTarget = {
    id: row.Name,
    preferredName: commonNames[0] ?? displayCatalogueName(row.Name),
    aliases: new Set([
      displayCatalogueName(row.Name),
      ...commonNames,
      ...splitList(row.Identifiers),
    ]),
    rightAscensionJ2000Hours: parseRightAscensionHours(row.RA),
    declinationJ2000Degrees: parseDeclinationDegrees(row.Dec),
    constellation: row.Const,
    objectType: row.Type,
    majorAxisArcminutes: optionalNumber(row.MajAx),
    minorAxisArcminutes: optionalNumber(row.MinAx),
    positionAngleDegrees: optionalNumber(row.PosAng),
    magnitude: optionalNumber(row['V-Mag']) ?? optionalNumber(row['B-Mag']),
    memberships: { messier: new Set(), ngc: new Set(), ic: new Set() },
    prominenceTier: determineProminenceTier(row, commonNames.length > 0),
  };
  addCatalogueMemberships(target, row);
  return target;
}

function duplicateCanonicalId(row: CsvRow): string | undefined {
  const ngc = splitList(row.NGC)[0];
  if (ngc) {
    return `NGC${ngc.padStart(4, '0')}`;
  }
  const ic = splitList(row.IC)[0];
  if (ic) {
    return `IC${ic.padStart(4, '0')}`;
  }
  if (row.Name === 'M102') {
    return 'NGC5457';
  }
  return undefined;
}

function parseCaldwellMappings(text: string): CaldwellMapping[] {
  const rows = parseCsvObjects(text, ',');
  return rows.map((row) => ({
    caldwellNumber: Number(row.caldwellNumber),
    sourceName: row.sourceName,
    additionalAliases: row.additionalAliases.split('|').filter(Boolean),
  }));
}

function finalizeTarget(target: MutableTarget): CatalogueTarget {
  const result: CatalogueTarget = {
    ...target,
    aliases: [...target.aliases]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'en')),
    memberships: {
      messier: [...target.memberships.messier].sort(
        (left, right) => left - right,
      ),
      ngc: [...target.memberships.ngc].sort(),
      ic: [...target.memberships.ic].sort(),
      ...(target.memberships.caldwell === undefined
        ? {}
        : { caldwell: target.memberships.caldwell }),
    },
  };
  return Object.fromEntries(
    Object.entries(result).filter(([, value]) => value !== undefined),
  ) as unknown as CatalogueTarget;
}

export async function buildCatalogueArtifacts(
  sourceDirectory: string,
): Promise<CatalogueArtifacts> {
  const [ngcText, addendumText, caldwellText] = await Promise.all([
    readFile(path.join(sourceDirectory, 'openngc-v20260501-ngc.csv'), 'utf8'),
    readFile(
      path.join(sourceDirectory, 'openngc-v20260501-addendum.csv'),
      'utf8',
    ),
    readFile(path.join(sourceDirectory, 'caldwell-2026-08-19.csv'), 'utf8'),
  ]);
  const rows = [...parseCsvObjects(ngcText), ...parseCsvObjects(addendumText)];
  const targetsById = new Map<string, MutableTarget>();
  let excludedNonexistentRows = 0;

  for (const row of rows) {
    if (row.Type === 'NonEx') {
      excludedNonexistentRows += 1;
    } else if (row.Type !== 'Dup') {
      targetsById.set(row.Name, createTarget(row));
    }
  }

  const unresolvedDuplicateAliases: string[] = [];
  let resolvedDuplicateAliases = 0;
  for (const row of rows.filter((candidate) => candidate.Type === 'Dup')) {
    const canonicalId = duplicateCanonicalId(row);
    const target = canonicalId ? targetsById.get(canonicalId) : undefined;
    if (!target) {
      unresolvedDuplicateAliases.push(row.Name);
      continue;
    }
    target.aliases.add(displayCatalogueName(row.Name));
    if (row.Name === 'M102') {
      target.aliases.add('M 102');
      target.memberships.messier.add(102);
    } else {
      addCatalogueMemberships(target, row);
    }
    resolvedDuplicateAliases += 1;
  }

  const unresolvedCaldwellSourceNames: string[] = [];
  for (const mapping of parseCaldwellMappings(caldwellText)) {
    const target = targetsById.get(mapping.sourceName);
    if (!target) {
      unresolvedCaldwellSourceNames.push(mapping.sourceName);
      continue;
    }
    target.memberships.caldwell = mapping.caldwellNumber;
    target.aliases.add(`C ${mapping.caldwellNumber}`);
    for (const alias of mapping.additionalAliases) {
      target.aliases.add(alias);
    }
  }

  const targets = [...targetsById.values()]
    .map(finalizeTarget)
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const catalogue = {
    formatVersion: 1 as const,
    dataVersion: OPEN_NGC_RELEASE,
    targets,
  };
  const messierNumbers = [
    ...new Set(targets.flatMap((target) => target.memberships.messier)),
  ].sort((left, right) => left - right);
  const caldwellNumbers = targets
    .flatMap((target) =>
      target.memberships.caldwell === undefined
        ? []
        : [target.memberships.caldwell],
    )
    .sort((left, right) => left - right);
  const report = {
    sourceRows: rows.length,
    runtimeTargets: targets.length,
    excludedNonexistentRows,
    resolvedDuplicateAliases,
    unresolvedDuplicateAliases: unresolvedDuplicateAliases.sort(),
    unresolvedCaldwellSourceNames: unresolvedCaldwellSourceNames.sort(),
    catalogueMemberships: {
      messier: targets.filter((target) => target.memberships.messier.length > 0)
        .length,
      ngc: targets.filter((target) => target.memberships.ngc.length > 0).length,
      ic: targets.filter((target) => target.memberships.ic.length > 0).length,
      caldwell: targets.filter(
        (target) => target.memberships.caldwell !== undefined,
      ).length,
    },
    distinctMembershipNumbers: {
      messier: messierNumbers,
      caldwell: caldwellNumbers,
    },
  };
  const serializedCatalogue = `${JSON.stringify(catalogue)}\n`;
  const manifest = {
    formatVersion: 1 as const,
    dataVersion: OPEN_NGC_RELEASE,
    transformVersion: TRANSFORM_VERSION,
    generatedFromPinnedInputsOn: '2026-08-19',
    sources: [
      {
        name: 'OpenNGC',
        url: 'https://github.com/mattiaverga/OpenNGC',
        release: OPEN_NGC_RELEASE,
        commit: OPEN_NGC_COMMIT,
        license: 'CC BY-SA 4.0',
        attribution: 'OpenNGC contributors',
      },
      {
        name: 'Astronomical League Caldwell Program Object List',
        url: 'https://www.astroleague.org/caldwell-program-object-list/',
        release: 'snapshot-2026-08-19',
        commit: 'not-applicable',
        license:
          'Copyright; factual catalogue mapping reviewed for attribution',
        attribution: 'Astronomical League and Sir Patrick Moore',
      },
    ],
    outputSha256: createHash('sha256')
      .update(serializedCatalogue)
      .digest('hex'),
  };

  return {
    catalogue,
    report,
    manifest,
    serialized: {
      catalogue: serializedCatalogue,
      report: `${JSON.stringify(report, null, 2)}\n`,
      manifest: `${JSON.stringify(manifest, null, 2)}\n`,
    },
  };
}
