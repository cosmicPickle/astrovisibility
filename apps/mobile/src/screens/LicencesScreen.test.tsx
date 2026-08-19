import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LicencesScreen, type LicencesController } from './LicencesScreen';

const createController = (
  fileCleanupFailures: readonly string[] = [],
): LicencesController => ({
  deleteAllLocalData: jest.fn().mockResolvedValue({
    deletedOwnedFileCount: 2,
    fileCleanupFailures,
  }),
});

const renderWithSafeArea = (element: ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { height: 800, width: 400, x: 0, y: 0 },
        insets: { bottom: 24, left: 0, right: 0, top: 24 },
      }}
    >
      {element}
    </SafeAreaProvider>,
  );

describe('LicencesScreen privacy and local-data controls', () => {
  it('explains offline privacy and requires confirmation before deleting user data', async () => {
    const controller = createController();
    const view = await renderWithSafeArea(
      <LicencesScreen controller={controller} />,
    );

    expect(view.getByText(/never uploaded/i)).toBeTruthy();
    expect(view.getByText(/Prototype limits/i)).toBeTruthy();
    await fireEvent.press(view.getByText('Delete all local data'));
    expect(view.getByText('Delete everything local?')).toBeTruthy();
    expect(controller.deleteAllLocalData).not.toHaveBeenCalled();

    await fireEvent.press(view.getByText('Delete permanently'));
    await waitFor(() =>
      expect(controller.deleteAllLocalData).toHaveBeenCalled(),
    );
    expect(
      view.getByText('All user-created local data was deleted.'),
    ).toBeTruthy();
  });

  it('reports cleanup remnants after database deletion instead of claiming full success', async () => {
    const controller = createController(['profiles/panorama.jpg']);
    const view = await renderWithSafeArea(
      <LicencesScreen controller={controller} />,
    );

    await fireEvent.press(view.getByText('Delete all local data'));
    await fireEvent.press(view.getByText('Delete permanently'));

    expect(
      await view.findByText(/user records were deleted, but 1 local image/i),
    ).toBeTruthy();
  });
});
