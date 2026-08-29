import {
  createEquatorialAtlasTiles,
  createEquatorialCutoutMesh,
} from './registeredSkyGeometry';

describe('registered sky geometry', () => {
  it('creates a bounded seam-safe full-sphere atlas', () => {
    const tiles = createEquatorialAtlasTiles({
      heightPixels: 512,
      widthPixels: 1024,
    });

    expect(tiles).toHaveLength(72);
    expect(
      Math.max(...tiles.map(({ directions }) => directions.length)),
    ).toBeLessThanOrEqual(49);
    expect(tiles.flatMap(({ indices }) => indices).length).toBeLessThanOrEqual(
      72 * 216,
    );
    expect(tiles[0]?.texturePointsPixels[0]).toEqual({ x: 0, y: 0 });
    expect(tiles.at(-1)?.texturePointsPixels.at(-1)).toEqual({
      x: 1024,
      y: 512,
    });
    expect(tiles[0]?.directions[0]).toEqual({
      declinationJ2000Degrees: 90,
      rightAscensionJ2000Hours: 0,
    });
    expect(tiles.at(-1)?.directions.at(-1)).toEqual({
      declinationJ2000Degrees: -90,
      rightAscensionJ2000Hours: 0,
    });
  });

  it('centres a bounded cutout mesh on its catalogue coordinate across RA zero', () => {
    const mesh = createEquatorialCutoutMesh({
      centerDeclinationJ2000Degrees: 41.269,
      centerRightAscensionJ2000Hours: 23.99,
      fieldOfViewDegrees: 2,
      heightPixels: 256,
      widthPixels: 256,
    });
    const center = mesh.directions[Math.floor(mesh.directions.length / 2)];

    expect(mesh.columnCount).toBe(5);
    expect(mesh.rowCount).toBe(5);
    expect(mesh.directions).toHaveLength(25);
    expect(center?.rightAscensionJ2000Hours).toBeCloseTo(23.99, 10);
    expect(center?.declinationJ2000Degrees).toBeCloseTo(41.269, 10);
    expect(
      mesh.directions.every(
        ({ rightAscensionJ2000Hours }) =>
          rightAscensionJ2000Hours >= 0 && rightAscensionJ2000Hours < 24,
      ),
    ).toBe(true);
  });

  it('rejects malformed or unbounded mesh inputs', () => {
    expect(() =>
      createEquatorialAtlasTiles({ heightPixels: 0, widthPixels: 1024 }),
    ).toThrow('heightPixels');
    expect(() =>
      createEquatorialCutoutMesh({
        centerDeclinationJ2000Degrees: 0,
        centerRightAscensionJ2000Hours: 0,
        fieldOfViewDegrees: 181,
        heightPixels: 256,
        widthPixels: 256,
      }),
    ).toThrow('fieldOfViewDegrees');
  });
});
