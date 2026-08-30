export interface RuntimeStar {
  colorIndexBv?: number;
  declinationJ2000Degrees: number;
  id: string;
  magnitude: number;
  properName?: string;
  rightAscensionJ2000Hours: number;
}

export interface RuntimeConstellation {
  id: string;
  label: EquatorialCoordinate;
  lines: EquatorialCoordinate[][];
  name: string;
  rank: number;
}

export interface EquatorialCoordinate {
  declinationJ2000Degrees: number;
  rightAscensionJ2000Hours: number;
}

type JsonCoordinate = [number, number];

export interface ConstellationFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id: string;
    properties?: Record<string, unknown>;
    geometry:
      | { type: 'Point'; coordinates: JsonCoordinate }
      | { type: 'MultiLineString'; coordinates: JsonCoordinate[][] };
  }[];
}

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted && character === '"' && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((item) => item.length > 0)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
};

const finiteNumber = (value: string | undefined) => {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildStarData = (
  csvText: string,
  limitingMagnitude: number,
): { duplicateRows: number; rejectedRows: number; stars: RuntimeStar[] } => {
  if (!Number.isFinite(limitingMagnitude)) {
    throw new TypeError('limitingMagnitude must be finite');
  }
  const [header, ...rows] = parseCsvRows(csvText);
  if (!header) throw new TypeError('HYG CSV is empty');
  const columns = new Map(header.map((name, index) => [name, index]));
  for (const required of ['id', 'ra', 'dec', 'mag']) {
    if (!columns.has(required))
      throw new TypeError(`Missing HYG column: ${required}`);
  }

  const stars: RuntimeStar[] = [];
  const identities = new Set<string>();
  let rejectedRows = 0;
  let duplicateRows = 0;
  for (const row of rows) {
    const sourceId = row[columns.get('id')!]!;
    const rightAscensionJ2000Hours = finiteNumber(row[columns.get('ra')!]);
    const declinationJ2000Degrees = finiteNumber(row[columns.get('dec')!]);
    const magnitude = finiteNumber(row[columns.get('mag')!]);
    if (
      !sourceId ||
      rightAscensionJ2000Hours === undefined ||
      rightAscensionJ2000Hours < 0 ||
      rightAscensionJ2000Hours >= 24 ||
      declinationJ2000Degrees === undefined ||
      declinationJ2000Degrees < -90 ||
      declinationJ2000Degrees > 90 ||
      magnitude === undefined ||
      magnitude > limitingMagnitude
    ) {
      rejectedRows += 1;
      continue;
    }
    const id = `HYG-${sourceId}`;
    if (identities.has(id)) {
      duplicateRows += 1;
      continue;
    }
    identities.add(id);
    const colorIndexBv = finiteNumber(row[columns.get('ci') ?? -1]);
    const properName = row[columns.get('proper') ?? -1]?.trim();
    stars.push({
      ...(colorIndexBv === undefined ? {} : { colorIndexBv }),
      declinationJ2000Degrees,
      id,
      magnitude,
      ...(properName ? { properName } : {}),
      rightAscensionJ2000Hours,
    });
  }
  stars.sort((left, right) =>
    left.magnitude === right.magnitude
      ? left.id.localeCompare(right.id)
      : left.magnitude - right.magnitude,
  );
  return { duplicateRows, rejectedRows, stars };
};

const longitudeToRightAscensionHours = (longitudeDegrees: number) =>
  (((longitudeDegrees % 360) + 360) % 360) / 15;

const toEquatorialCoordinate = (
  coordinates: JsonCoordinate,
): EquatorialCoordinate => ({
  declinationJ2000Degrees: coordinates[1],
  rightAscensionJ2000Hours: longitudeToRightAscensionHours(coordinates[0]),
});

export const buildConstellationData = (
  lineData: ConstellationFeatureCollection,
  labelData: ConstellationFeatureCollection,
): RuntimeConstellation[] => {
  const labels = new Map(
    labelData.features
      .filter((feature) => feature.geometry.type === 'Point')
      .map((feature) => [feature.id, feature]),
  );
  const constellations = new Map<string, RuntimeConstellation>();
  for (const feature of lineData.features) {
    if (feature.geometry.type !== 'MultiLineString') continue;
    const labelFeature = labels.get(feature.id);
    if (!labelFeature || labelFeature.geometry.type !== 'Point') continue;
    const existing = constellations.get(feature.id);
    const name = String(labelFeature.properties?.name ?? feature.id);
    const rank = Number(
      labelFeature.properties?.rank ?? feature.properties?.rank ?? 3,
    );
    const lines = feature.geometry.coordinates.map((line) =>
      line.map(toEquatorialCoordinate),
    );
    if (existing) {
      existing.lines.push(...lines);
    } else {
      constellations.set(feature.id, {
        id: feature.id,
        label: toEquatorialCoordinate(labelFeature.geometry.coordinates),
        lines,
        name,
        rank: Number.isInteger(rank) && rank >= 1 && rank <= 3 ? rank : 3,
      });
    }
  }
  return [...constellations.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
};
