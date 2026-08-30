/** @jest-environment node */

import {
  buildConstellationData,
  buildStarData,
  type ConstellationFeatureCollection,
} from './skyAssetImporter.ts';

const starCsv = `"id","hip","proper","ra","dec","mag","ci"
"1","1","Sirius","6.7525","-16.7161","-1.46","0.00"
"2","2","","0","90","7.0",""
"3","3","Too dim","12","10","7.01","1.2"
"4","4","Bad coordinate","24","0","1","0.5"
"5","5","Bad magnitude","1","0","","0.5"
"1","1","Duplicate","6.7525","-16.7161","-1.46","0.00"`;

const constellationLines: ConstellationFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'Ser',
      properties: { rank: '2' },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [179, 4],
            [-179, 5],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'Ser',
      properties: { rank: '2' },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [15, -2],
            [30, -1],
          ],
        ],
      },
    },
  ],
};

const constellationLabels: ConstellationFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'Ser',
      properties: { name: 'Serpens', rank: '2' },
      geometry: { type: 'Point', coordinates: [-180, 1] },
    },
  ],
};

describe('registered sky asset importer', () => {
  it('filters, normalizes, deduplicates, and sorts HYG stars deterministically', () => {
    const result = buildStarData(starCsv, 7);

    expect(result.stars).toEqual([
      {
        colorIndexBv: 0,
        declinationJ2000Degrees: -16.7161,
        id: 'HYG-1',
        magnitude: -1.46,
        properName: 'Sirius',
        rightAscensionJ2000Hours: 6.7525,
      },
      {
        declinationJ2000Degrees: 90,
        id: 'HYG-2',
        magnitude: 7,
        rightAscensionJ2000Hours: 0,
      },
    ]);
    expect(result.rejectedRows).toBe(3);
    expect(result.duplicateRows).toBe(1);
  });

  it('merges split constellation features and converts GeoJSON longitude to RA', () => {
    const result = buildConstellationData(
      constellationLines,
      constellationLabels,
    );

    expect(result).toEqual([
      {
        id: 'Ser',
        label: {
          declinationJ2000Degrees: 1,
          rightAscensionJ2000Hours: 12,
        },
        lines: [
          [
            {
              declinationJ2000Degrees: 4,
              rightAscensionJ2000Hours: 11.933333333333334,
            },
            {
              declinationJ2000Degrees: 5,
              rightAscensionJ2000Hours: 12.066666666666666,
            },
          ],
          [
            {
              declinationJ2000Degrees: -2,
              rightAscensionJ2000Hours: 1,
            },
            {
              declinationJ2000Degrees: -1,
              rightAscensionJ2000Hours: 2,
            },
          ],
        ],
        name: 'Serpens',
        rank: 2,
      },
    ]);
  });

  it('keeps the Cygnus Deneb vertex at Deneb right ascension', () => {
    const result = buildConstellationData(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'Cyg',
            geometry: {
              type: 'MultiLineString',
              coordinates: [[[-49.642, 45.2803]]],
            },
          },
        ],
      },
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'Cyg',
            properties: { name: 'Cygnus', rank: '1' },
            geometry: { type: 'Point', coordinates: [-52.5, 50] },
          },
        ],
      },
    );

    expect(result[0]?.lines[0]?.[0]?.declinationJ2000Degrees).toBe(45.2803);
    expect(result[0]?.lines[0]?.[0]?.rightAscensionJ2000Hours).toBeCloseTo(
      20.69053333333333,
      12,
    );
  });
});
