import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import licenceManifest from '../catalogue/generated/licence-manifest.json';
import validationReport from '../catalogue/generated/validation-report.json';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { SectionCard } from '../components/ui/SectionCard';
import { selectedTrajectoryCache } from '../astronomy/obstructionVisibility';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import {
  deleteAllLocalUserData,
  type DeleteAllLocalUserDataResult,
} from '../storage/localDataMaintenance';
import { clearSkySelectionHandoffs } from '../targets/skySelectionHandoff';
import { colors, layout } from '../theme/tokens';

export interface LicencesController {
  deleteAllLocalData(): Promise<DeleteAllLocalUserDataResult>;
}

const defaultController: LicencesController = {
  async deleteAllLocalData() {
    const storage = await bootstrapStorage();
    const result = await deleteAllLocalUserData(
      storage.database,
      storage.files,
    );
    selectedTrajectoryCache.clear();
    clearSkySelectionHandoffs();
    return result;
  },
};

export const LicencesScreen = ({
  controller = defaultController,
}: {
  controller?: LicencesController;
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const deleteAll = async () => {
    setDeleting(true);
    setDeleteMessage(null);
    try {
      const result = await controller.deleteAllLocalData();
      setConfirmDelete(false);
      setDeleteMessage(
        result.fileCleanupFailures.length === 0
          ? 'All user-created local data was deleted.'
          : `Your user records were deleted, but ${result.fileCleanupFailures.length} local image${result.fileCleanupFailures.length === 1 ? '' : 's'} could not be removed. Restart Astrovisibility to retry cleanup.`,
      );
    } catch {
      setDeleteMessage(
        'Local data could not be deleted. Nothing was reported as complete; try again after restarting the app.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AppText tone="label">About · licences</AppText>
          <AppText tone="title">About Astrovisibility</AppText>
          <AppText tone="muted">
            Astrovisibility bundles its catalogue so sky browsing works without
            a network connection.
          </AppText>
        </View>

        <SectionCard>
          <AppText tone="label">Private and local by design</AppText>
          <AppText>
            Profiles, exact coordinates, panorama images, masks, and equipment
            stay in this app’s private storage and are never uploaded by v1.
          </AppText>
          <AppText tone="muted">
            Camera, foreground location, and motion are used only for actions
            you start. Astrovisibility has no account, analytics, cloud backup,
            or background location access. Deleting or uninstalling the app
            cannot be undone because there is no server copy.
          </AppText>
        </SectionCard>

        <SectionCard>
          <AppText tone="label">OpenNGC {licenceManifest.dataVersion}</AppText>
          <AppText>
            {validationReport.runtimeTargets.toLocaleString()} normalized
            targets, derived from OpenNGC contributors under CC BY-SA 4.0.
          </AppText>
          <AppText tone="muted">
            Source commit {licenceManifest.sources[0].commit.slice(0, 12)} ·
            output checksum {licenceManifest.outputSha256.slice(0, 12)}…
          </AppText>
          <ActionButton
            label="Open OpenNGC source and licence"
            onPress={() => void Linking.openURL(licenceManifest.sources[0].url)}
            variant="secondary"
          />
        </SectionCard>

        <SectionCard>
          <AppText tone="label">Caldwell catalogue</AppText>
          <AppText>
            All {validationReport.catalogueMemberships.caldwell} memberships are
            cross-referenced against the Astronomical League list and the
            bundled OpenNGC coordinates.
          </AppText>
          <AppText tone="muted">
            Attribution: {licenceManifest.sources[1].attribution}.
          </AppText>
          <ActionButton
            label="Open Astronomical League list"
            onPress={() => void Linking.openURL(licenceManifest.sources[1].url)}
            variant="secondary"
          />
        </SectionCard>

        <SectionCard>
          <AppText tone="label">Prototype limits</AppText>
          <AppText>
            Panorama alignment uses phone sensors plus manual correction.
            Magnetic interference, thin nearby branches, camera field-of-view
            differences, and very dense masks can reduce precision.
          </AppText>
          <AppText tone="muted">
            Confirm directions against the real sky before relying on a plan. V1
            evaluates each target centre, not the whole camera frame, and does
            not control telescope hardware. Physical-device capture and
            mid-range performance validation remain required before wider
            distribution.
          </AppText>
        </SectionCard>

        <SectionCard>
          <AppText tone="label">Your local data</AppText>
          <AppText>
            Delete every profile, setup, panorama, mask, and capture draft from
            this device. The bundled astronomy catalogue remains available.
          </AppText>
          <ActionButton
            label="Delete all local data"
            onPress={() => setConfirmDelete(true)}
            variant="danger"
          />
          {deleteMessage ? (
            <AppText accessibilityLiveRegion="polite" tone="muted">
              {deleteMessage}
            </AppText>
          ) : null}
        </SectionCard>
      </ScrollView>
      <ModalSheet
        closeAccessibilityLabel="Keep local data"
        onClose={() => setConfirmDelete(false)}
        title="Delete everything local?"
        visible={confirmDelete}
      >
        <AppText tone="muted">
          This permanently removes all user-created Astrovisibility data from
          this device. There is no cloud backup and this cannot be undone.
        </AppText>
        <ActionButton
          label="Delete permanently"
          loading={deleting}
          onPress={() => void deleteAll()}
          variant="danger"
        />
      </ModalSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: layout.sectionGap,
    padding: layout.screenPadding,
  },
  header: {
    gap: 7,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
