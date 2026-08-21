import { processResourcesSequentially } from './directionalAtlasImage';

describe('processResourcesSequentially', () => {
  it('keeps only one decoded capture resource alive at a time', async () => {
    let activeResources = 0;
    let maximumActiveResources = 0;
    const rendered: number[] = [];
    const disposed: number[] = [];

    await processResourcesSequentially(
      [1, 2, 3],
      async (value) => {
        activeResources += 1;
        maximumActiveResources = Math.max(
          maximumActiveResources,
          activeResources,
        );
        return {
          dispose() {
            activeResources -= 1;
            disposed.push(value);
          },
          value,
        };
      },
      async ({ value }) => {
        rendered.push(value);
      },
    );

    expect(maximumActiveResources).toBe(1);
    expect(rendered).toEqual([1, 2, 3]);
    expect(disposed).toEqual([1, 2, 3]);
    expect(activeResources).toBe(0);
  });

  it('disposes the current resource when rendering fails', async () => {
    const dispose = jest.fn();

    await expect(
      processResourcesSequentially(
        ['tile'],
        async () => ({ dispose }),
        async () => {
          throw new Error('render failed');
        },
      ),
    ).rejects.toThrow('render failed');
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
