import {
  Camera,
  CameraView,
  type CameraPictureOptions,
  useCameraPermissions,
} from 'expo-camera';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapturedTileMosaic } from '../components/capture/CapturedTileMosaic';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { SectionCard } from '../components/ui/SectionCard';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import type {
  ActivePanorama,
  CaptureDraftTileInput,
  PanoramaCaptureDraft,
} from '../storage/panoramaDraftRepository';
import type { ProfileRecord } from '../storage/profileRepository';
import { createLocalRecordId } from '../storage/recordIdentity';
import { colors, layout } from '../theme/tokens';
import {
  applyTileCorrection,
  createCapturedTile,
  type CapturedProofTile,
} from './captureSession';
import {
  devicePoseToOrientationSnapshot,
  type DevicePoseSample,
} from './devicePose';
import { PoseDrivenCaptureView } from './PoseDrivenCaptureView';
import { useDevicePose } from './useDevicePose';

interface CaptureLoadResult {
  profile: ProfileRecord;
  profileName: string;
  activePanorama: ActivePanorama | null;
  draft: PanoramaCaptureDraft | null;
}

export interface PanoramaCaptureController {
  load(profileId: string): Promise<CaptureLoadResult>;
  createDraft(profileId: string): Promise<PanoramaCaptureDraft>;
  addTile(
    draftId: string,
    tile: CaptureDraftTileInput,
  ): Promise<PanoramaCaptureDraft>;
  updateTilePlacement(
    draftId: string,
    tileId: string,
    placement: CapturedProofTile['reviewedPlacement'],
  ): Promise<PanoramaCaptureDraft>;
  discardDraft(draftId: string): Promise<void>;
  completeDraft(draftId: string): Promise<void>;
}

export interface PickedPanoramaImage {
  uri: string;
  widthPixels: number;
  heightPixels: number;
  fileExtension: string;
}

export const PANORAMA_CAPTURE_PICTURE_OPTIONS = {
  quality: 0.55,
  shutterSound: false,
} satisfies CameraPictureOptions;

export interface PanoramaCaptureServices {
  getCameraPermission?(): Promise<boolean>;
  openSettings(): Promise<void>;
  requestCameraPermission(): Promise<boolean>;
  takePicture(camera: CameraView | null): Promise<PickedPanoramaImage>;
}

export async function refreshCapturePermissions(
  services: PanoramaCaptureServices,
): Promise<{ cameraGranted: boolean }> {
  const cameraGranted = (await services.getCameraPermission?.()) ?? false;
  return { cameraGranted };
}

export const panoramaCaptureController: PanoramaCaptureController = {
  async load(profileId) {
    const storage = await bootstrapStorage();
    const [profile, activePanorama, draft] = await Promise.all([
      storage.profiles.getById(profileId),
      storage.panoramas.getActiveForProfile(profileId),
      storage.panoramas.getForProfile(profileId),
    ]);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    return { profile, profileName: profile.name, activePanorama, draft };
  },
  async createDraft(profileId) {
    const storage = await bootstrapStorage();
    const id = createLocalRecordId('panorama-draft');
    await storage.panoramas.create(id, profileId, new Date().toISOString());
    const draft = await storage.panoramas.getById(id);
    if (!draft) throw new Error('The panorama draft could not be reopened.');
    return draft;
  },
  async addTile(draftId, tile) {
    const storage = await bootstrapStorage();
    await storage.panoramas.addTile(draftId, tile, new Date().toISOString());
    const draft = await storage.panoramas.getById(draftId);
    if (!draft) throw new Error('The panorama draft could not be reopened.');
    return draft;
  },
  async updateTilePlacement(draftId, tileId, placement) {
    const storage = await bootstrapStorage();
    await storage.panoramas.updateTilePlacement(
      draftId,
      tileId,
      placement,
      new Date().toISOString(),
    );
    const draft = await storage.panoramas.getById(draftId);
    if (!draft) throw new Error('The panorama draft could not be reopened.');
    return draft;
  },
  async discardDraft(draftId) {
    const storage = await bootstrapStorage();
    await storage.panoramas.discard(draftId);
  },
  async completeDraft(draftId) {
    const storage = await bootstrapStorage();
    await storage.panoramas.complete(
      draftId,
      createLocalRecordId('panorama'),
      new Date().toISOString(),
    );
  },
};

const countLabel = (count: number) =>
  `${count} tile${count === 1 ? '' : 's'} · 360° not required`;
const degrees = (value: number) => `${Math.round(value)}°`;

export const PanoramaCaptureScreen = ({
  controller = panoramaCaptureController,
  navigation,
  profileId,
  services,
}: {
  controller?: PanoramaCaptureController;
  navigation: { goBack(): void; onSaved(): void };
  profileId: string;
  services?: PanoramaCaptureServices;
}) => {
  const camera = useRef<CameraView>(null);
  const [, requestCameraPermission] = useCameraPermissions();
  const [loadResult, setLoadResult] = useState<CaptureLoadResult | null>(null);
  const [draft, setDraft] = useState<PanoramaCaptureDraft | null>(null);
  const [mode, setMode] = useState<'intro' | 'capture' | 'review'>('intro');
  const [cameraGranted, setCameraGranted] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const devicePose = useDevicePose(
    mode === 'capture',
    loadResult?.profile ?? null,
  );

  const native = useMemo<PanoramaCaptureServices>(
    () =>
      services ?? {
        async getCameraPermission() {
          return (await Camera.getCameraPermissionsAsync()).granted;
        },
        openSettings: Linking.openSettings,
        async requestCameraPermission() {
          return (await requestCameraPermission()).granted;
        },
        async takePicture(cameraView) {
          if (!cameraView) throw new Error('Camera preview is not ready.');
          const picture = await cameraView.takePictureAsync(
            PANORAMA_CAPTURE_PICTURE_OPTIONS,
          );
          return {
            uri: picture.uri,
            widthPixels: picture.width,
            heightPixels: picture.height,
            fileExtension: 'jpg',
          };
        },
      },
    [requestCameraPermission, services],
  );

  const load = async () => {
    setLoadFailed(false);
    setError(null);
    try {
      const result = await controller.load(profileId);
      setLoadResult(result);
      setDraft(result.draft);
      setSelectedTileId(result.draft?.tiles[0]?.id ?? null);
    } catch {
      setLoadFailed(true);
    }
  };

  useEffect(() => {
    let active = true;
    void controller.load(profileId).then(
      (result) => {
        if (!active) return;
        setLoadFailed(false);
        setLoadResult(result);
        setDraft(result.draft);
        setSelectedTileId(result.draft?.tiles[0]?.id ?? null);
      },
      () => {
        if (active) setLoadFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [controller, profileId]);

  useEffect(() => {
    if (mode !== 'capture') return undefined;
    let active = true;
    const refresh = () => {
      void refreshCapturePermissions(native).then(
        (permissions) => {
          if (!active) return;
          setCameraGranted(permissions.cameraGranted);
          if (!permissions.cameraGranted) {
            setError(
              'Camera access is unavailable. Retry or enable access in system settings.',
            );
          }
        },
        () => {
          if (active) {
            setCameraGranted(false);
          }
        },
      );
    };
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [mode, native]);

  const ensureDraft = async () => {
    if (draft) return draft;
    const created = await controller.createDraft(profileId);
    setDraft(created);
    return created;
  };

  const prepareCapture = async () => {
    setBusy(true);
    setError(null);
    try {
      await ensureDraft();
      const granted = await native.requestCameraPermission();
      setCameraGranted(granted);
      setMode('capture');
    } catch {
      setError('Capture could not start. Your existing draft remains safe.');
    } finally {
      setBusy(false);
    }
  };

  const persistAsset = async (
    asset: PickedPanoramaImage,
    capturePose: DevicePoseSample,
  ) => {
    const activeDraft = await ensureDraft();
    const orientation = devicePoseToOrientationSnapshot(capturePose);
    const captured = createCapturedTile({
      id: createLocalRecordId('tile'),
      uri: asset.uri,
      widthPixels: asset.widthPixels,
      heightPixels: asset.heightPixels,
      capturedAtUtc: new Date().toISOString(),
      orientation,
      horizontalFieldOfViewDegrees: devicePose.fieldOfView.horizontalDegrees,
      verticalFieldOfViewDegrees: devicePose.fieldOfView.verticalDegrees,
      sourceKind: 'camera',
      motionAvailable: true,
    });
    const updated = await controller.addTile(activeDraft.id, {
      ...captured,
      temporaryUri: asset.uri,
      fileExtension: asset.fileExtension,
    });
    setDraft(updated);
    setSelectedTileId(captured.id);
  };

  const captureTile = async () => {
    const capturePose = devicePose.getCapturePose();
    if (!capturePose) return;
    setBusy(true);
    setError(null);
    try {
      await persistAsset(await native.takePicture(camera.current), capturePose);
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : 'Capture failed without changing the draft.',
      );
    } finally {
      setBusy(false);
    }
  };

  const openReview = () => {
    setSelectedTileId(draft?.tiles[0]?.id ?? null);
    setMode('review');
  };

  const selectedTile =
    draft?.tiles.find((tile) => tile.id === selectedTileId) ?? null;
  const correctSelectedTile = async (
    correction: Parameters<typeof applyTileCorrection>[1],
  ) => {
    if (!draft || !selectedTile) return;
    setBusy(true);
    setError(null);
    try {
      const corrected = applyTileCorrection(selectedTile, correction);
      setDraft(
        await controller.updateTilePlacement(
          draft.id,
          selectedTile.id,
          corrected.reviewedPlacement,
        ),
      );
    } catch {
      setError('The tile correction could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await controller.discardDraft(draft.id);
      setDraft(null);
      setSelectedTileId(null);
      setConfirmDiscard(false);
      setMode('intro');
    } catch {
      setError('The draft could not be discarded. Its images remain local.');
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!draft || draft.tiles.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await controller.completeDraft(draft.id);
      navigation.onSaved();
    } catch {
      setError(
        'The panorama could not be saved. The complete draft remains available to retry.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!loadResult) {
    return (
      <SafeAreaView style={styles.centered}>
        {loadFailed ? (
          <>
            <AppText tone="title">Capture unavailable</AppText>
            <AppText tone="muted">The local profile could not be read.</AppText>
            <ActionButton label="Try again" onPress={() => void load()} />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} size="large" />
        )}
      </SafeAreaView>
    );
  }

  if (loadResult.activePanorama) {
    return (
      <SafeAreaView style={styles.centered}>
        <AppText tone="title">Panorama already saved</AppText>
        <AppText tone="muted">
          Delete the existing panorama and mask pair before starting a new
          capture.
        </AppText>
        <ActionButton label="Back to Sky View" onPress={navigation.goBack} />
      </SafeAreaView>
    );
  }

  if (mode === 'intro') {
    return (
      <SafeAreaView edges={['bottom']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppText tone="title">Capture surroundings</AppText>
          <AppText tone="muted">{loadResult.profileName}</AppText>
          <SectionCard>
            <AppText tone="label">Stay at the observing position</AppText>
            <AppText>
              Hold the phone as close as practical to the telescope or camera. A
              single narrow view is valid; capture only the directions that
              matter.
            </AppText>
          </SectionCard>
          <SectionCard>
            <AppText tone="label">Before permissions</AppText>
            <AppText>
              Camera access records surroundings. The phone rotation sensor and
              saved profile location align the view to true north, altitude, and
              roll. No additional location permission is required.
            </AppText>
            <AppText tone="muted">
              Images, directions, and drafts stay in app-local storage. Sensor
              direction must be available and steady before capture.
            </AppText>
          </SectionCard>
          {draft ? (
            <SectionCard>
              <AppText tone="label">
                Resume {draft.tiles.length}-tile draft
              </AppText>
              <AppText tone="muted">
                Accepted images are already stored locally and survive restart.
              </AppText>
              <ActionButton
                label="Resume capture"
                loading={busy}
                onPress={() => void prepareCapture()}
              />
              {draft.tiles.length > 0 ? (
                <ActionButton
                  label="Review draft"
                  onPress={openReview}
                  variant="secondary"
                />
              ) : null}
              <ActionButton
                label="Discard draft"
                onPress={() => setConfirmDiscard(true)}
                variant="danger"
              />
            </SectionCard>
          ) : (
            <ActionButton
              label="Start capture"
              loading={busy}
              onPress={() => void prepareCapture()}
            />
          )}
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
        </ScrollView>
        <ModalSheet
          closeAccessibilityLabel="Keep panorama draft"
          onClose={() => setConfirmDiscard(false)}
          title="Discard panorama draft?"
          visible={confirmDiscard}
        >
          <AppText tone="muted">
            Every accepted draft image and its alignment will be removed from
            this device.
          </AppText>
          <ActionButton
            label="Discard"
            loading={busy}
            onPress={() => void discard()}
            variant="danger"
          />
        </ModalSheet>
      </SafeAreaView>
    );
  }

  if (mode === 'capture') {
    return (
      <SafeAreaView edges={['bottom']} style={styles.screen}>
        <View style={styles.captureHeader}>
          <View style={styles.headerCopy}>
            <AppText tone="label">Point and capture</AppText>
            <AppText tone="muted">
              {countLabel(draft?.tiles.length ?? 0)}
            </AppText>
          </View>
          <ActionButton
            label="Back"
            onPress={() => setMode('intro')}
            variant="text"
          />
        </View>
        <PoseDrivenCaptureView
          busy={busy}
          cameraGranted={cameraGranted}
          cameraRef={camera}
          fieldOfView={devicePose.fieldOfView}
          onCapture={() => void captureTile()}
          onOpenSettings={() => void native.openSettings()}
          onReview={openReview}
          pose={devicePose.pose}
          poseError={devicePose.error ?? error}
          poseReadiness={devicePose.readiness}
          profile={loadResult.profile}
          tiles={draft?.tiles ?? []}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <AppText tone="label">Review tile alignment</AppText>
            <AppText tone="muted">
              {countLabel(draft?.tiles.length ?? 0)}
            </AppText>
          </View>
          <ActionButton
            label="Camera"
            onPress={() => setMode('capture')}
            variant="secondary"
          />
        </View>

        <>
          <CapturedTileMosaic
            onDragTile={(tileId, correction) => {
              setSelectedTileId(tileId);
              void correctSelectedTile({
                azimuthDeltaDegrees: correction.azimuthDeltaDegrees,
                altitudeDeltaDegrees: correction.altitudeDeltaDegrees,
                rollDeltaDegrees: 0,
              });
            }}
            onSelectTile={setSelectedTileId}
            selectedTileId={selectedTileId}
            tiles={draft?.tiles ?? []}
          />
          {selectedTile ? (
            <SectionCard>
              <AppText tone="label">
                {selectedTile.orientationConfidence} sensor confidence
              </AppText>
              <AppText>
                {degrees(selectedTile.reviewedPlacement.centerAzimuthDegrees)}
                {' az · '}
                {degrees(selectedTile.reviewedPlacement.centerAltitudeDegrees)}
                {' alt · '}
                {degrees(selectedTile.reviewedPlacement.rollDegrees)} roll
              </AppText>
              <AppText tone="muted">
                Drag the selected tile for azimuth/altitude alignment, then use
                the fine controls for exact correction.
              </AppText>
              <View style={styles.buttonRow}>
                {[
                  ['Alt −5°', 0, -5, 0],
                  ['Alt +5°', 0, 5, 0],
                  ['Roll −1°', 0, 0, -1],
                  ['Roll +1°', 0, 0, 1],
                ].map(
                  ([
                    label,
                    azimuthDeltaDegrees,
                    altitudeDeltaDegrees,
                    rollDeltaDegrees,
                  ]) => (
                    <ActionButton
                      key={label}
                      label={label as string}
                      onPress={() =>
                        void correctSelectedTile({
                          azimuthDeltaDegrees: azimuthDeltaDegrees as number,
                          altitudeDeltaDegrees: altitudeDeltaDegrees as number,
                          rollDeltaDegrees: rollDeltaDegrees as number,
                        })
                      }
                      variant="secondary"
                    />
                  ),
                )}
              </View>
            </SectionCard>
          ) : null}
          <AppText tone="muted">
            Saving accepts this partial coverage. Uncaptured directions are not
            assigned visibility until Stage 6 mask completion.
          </AppText>
          <ActionButton
            disabled={!draft?.tiles.length}
            label="Save panorama"
            loading={busy}
            onPress={() => void complete()}
          />
        </>
        {error ? (
          <AppText accessibilityRole="alert" style={styles.error}>
            {error}
          </AppText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  captureHeader: {
    alignItems: 'center',
    borderBottomColor: colors.outline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: 8,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: layout.sectionGap,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  content: {
    gap: layout.sectionGap,
    padding: layout.screenPadding,
  },
  error: {
    color: colors.danger,
  },
  headerCopy: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
