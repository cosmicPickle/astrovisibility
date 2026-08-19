import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import { CatalogueRepository } from './catalogueRepository';
import type { SqlDatabase } from './types';

const target: CatalogueTarget = {
  id: 'NGC1976',
  preferredName: 'Orion Nebula',
  aliases: ['M 42', 'NGC 1976'],
  rightAscensionJ2000Hours: 5.588,
  declinationJ2000Degrees: -5.391,
  constellation: 'Ori',
  objectType: 'HII',
  memberships: { messier: [42], ngc: ['NGC 1976'], ic: [] },
  prominenceTier: 1,
};

function databaseWith(rows: { targetJson: string }[]): SqlDatabase {
  return {
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue(rows),
  } as unknown as SqlDatabase;
}

describe('CatalogueRepository', () => {
  it('returns deterministic validated catalogue targets', async () => {
    const database = databaseWith([{ targetJson: JSON.stringify(target) }]);
    const result = await new CatalogueRepository(database).listAll();
    expect(result).toEqual([target]);
    expect(database.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY id'),
    );
  });

  it('rejects corrupted local catalogue rows instead of drawing invalid data', async () => {
    const database = databaseWith([{ targetJson: '{"id":"broken"}' }]);
    await expect(new CatalogueRepository(database).listAll()).rejects.toThrow(
      'Invalid catalogue target',
    );
  });
});
