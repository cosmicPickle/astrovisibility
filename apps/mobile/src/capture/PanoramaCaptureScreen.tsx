import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptureCoverageMap } from '../components/capture/CaptureCoverageMap';
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
import { createLocalRecordId } from '../storage/recordIdentity';
import { colors, layout } from '../theme/tokens';
import {
  applyTileCorrection,
  createCapturedTile,
  type CapturedProofTile,
} from './captureSession';
import { useCaptureOrientation } from './useCaptureOrientation';

interface CaptureLoadResult {
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

export interface PanoramaCaptureServices {
  getCameraPermission?(): Promise<boolean>;
  getLocationPermission?(): Promise<boolean>;
  openSettings(): Promise<void>;
  pickImage(): Promise<PickedPanoramaImage | null>;
  requestCameraPermission(): Promise<boolean>;
  requestLocationPermission(): Promise<boolean>;
  takePicture(camera: CameraView | null): Promise<PickedPanoramaImage>;
}

export async function refreshCapturePermissions(
  services: PanoramaCaptureServices,
): Promise<{ cameraGranted: boolean; locationGranted: boolean }> {
  const [cameraGranted, locationGranted] = await Promise.all([
    services.getCameraPermission?.() ?? Promise.resolve(false),
    services.getLocationPermission?.() ?? Promise.resolve(false),
  ]);
  return { cameraGranted, locationGranted };
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
    return { profileName: profile.name, activePanorama, draft };
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

const fileExtensionFromAsset = (asset: ImagePicker.ImagePickerAsset) => {
  const fromName = asset.fileName?.split('.').at(-1)?.toLowerCase();
  if (fromName?.match(/^[a-z0-9]{1,5}$/)) return fromName;
  if (asset.mimeType === 'image/png') return 'png';
  return 'jpg';
};

const defaultPickImage = async (): Promise<PickedPanoramaImage | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission denied.');
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    mediaTypes: ['images'],
    quality: 0.8,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset
    ? {
        uri: asset.uri,
        widthPixels: asset.width,
        heightPixels: asset.height,
        fileExtension: fileExtensionFromAsset(asset),
      }
    : null;
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
  const [locationGranted, setLocationGranted] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { motionAvailable, orientation, sensorError } = useCaptureOrientation(
    mode === 'capture',
    locationGranted,
  );

  const native = useMemo<PanoramaCaptureServices>(
    () =>
      services ?? {
        async getCameraPermission() {
          return (await Camera.getCameraPermissionsAsync()).granted;
        },
        async getLocationPermission() {
          return (await Location.getForegroundPermissionsAsync()).granted;
        },
        openSettings: Linking.openSettings,
        pickImage: defaultPickImage,
        async requestCameraPermission() {
          return (await requestCameraPermission()).granted;
        },
        async requestLocationPermission() {
          return (await Location.requestForegroundPermissionsAsync()).granted;
        },
        async takePicture(cameraView) {
          if (!cameraView) throw new Error('Camera preview is not ready.');
          const picture = await cameraView.takePictureAsync({ quality: 0.55 });
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
          setLocationGranted(permissions.locationGranted);
          if (!permissions.cameraGranted) {
            setError(
              'Camera access is unavailable. Import an image, retry, or enable access in system settings.',
            );
          }
        },
        () => {
          if (active) {
            setCameraGranted(false);
            setLocationGranted(false);
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
      setLocationGranted(await native.requestLocationPermission());
      setMode('capture');
    } catch {
      setError('Capture could not start. Your existing draft remains safe.');
    } finally {
      setBusy(false);
    }
  };

  const persistAsset = async (
    asset: PickedPanoramaImage,
    sourceKind: 'camera' | 'import',
  ) => {
    const activeDraft = await ensureDraft();
    const captured = createCapturedTile({
      id: createLocalRecordId('tile'),
      uri: asset.uri,
      widthPixels: asset.widthPixels,
      heightPixels: asset.heightPixels,
      capturedAtUtc: new Date().toISOString(),
      orientation,
      horizontalFieldOfViewDegrees: 62,
      verticalFieldOfViewDegrees: 62 * (asset.heightPixels / asset.widthPixels),
      sourceKind,
      motionAvailable: motionAvailable === true,
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
    setBusy(true);
    setError(null);
    try {
      await persistAsset(await native.takePicture(camera.current), 'camera');
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

  const importTile = async () => {
    setBusy(true);
    setError(null);
    try {
      const asset = await native.pickImage();
      if (asset) await persistAsset(asset, 'import');
    } catch (importError) {
      setError(
        importError instanceof Error
          ? `${importError.message} You can retry or open system settings.`
          : 'The image could not be imported.',
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
              Camera access records surroundings. Foreground location estimates
              true north, and motion estimates altitude and roll. They are
              requested only after you continue and are used only during this
              capture.
            </AppText>
            <AppText tone="muted">
              Images, directions, and drafts stay in app-local storage. Location
              and motion denial still allow image import and manual placement.
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

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <AppText tone="label">
              {mode === 'capture'
                ? 'Guided partial capture'
                : 'Review tile alignment'}
            </AppText>
            <AppText tone="muted">
              {countLabel(draft?.tiles.length ?? 0)}
            </AppText>
          </View>
          <ActionButton
            label={mode === 'capture' ? 'Review' : 'Camera'}
            onPress={() =>
              mode === 'capture' ? openReview() : setMode('capture')
            }
            variant="secondary"
          />
        </View>

        {mode === 'capture' ? (
          <>
            <View style={styles.cameraFrame}>
              {cameraGranted ? (
                <CameraView
                  facing="back"
                  ref={camera}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={styles.cameraFallback}>
                  <AppText style={styles.cameraFallbackTitle}>
                    Camera access unavailable
                  </AppText>
                  <AppText tone="muted">
                    You can import images and place them manually, retry later,
                    or enable access in system settings.
                  </AppText>
                </View>
              )}
              <View pointerEvents="none" style={styles.reticle} />
              <View style={styles.sensorPanel}>
                <AppText style={styles.sensorValue}>
                  {degrees(orientation.trueHeadingDegrees)} az ·{' '}
                  {degrees(orientation.estimatedAltitudeDegrees)} alt ·{' '}
                  {degrees(orientation.rollDegrees)} roll
                </AppText>
                <AppText style={styles.sensorDetail}>
                  Heading accuracy{' '}
                  {orientation.headingAccuracyDegrees === null
                    ? 'unknown'
                    : `±${orientation.headingAccuracyDegrees}°`}
                </AppText>
              </View>
            </View>
            <CaptureCoverageMap
              orientation={orientation}
              tiles={draft?.tiles ?? []}
            />
            {orientation.headingAccuracyDegrees === null ||
            orientation.headingAccuracyDegrees > 25 ? (
              <AppText style={styles.warning}>
                Heading confidence is low. Calibrate away from metal or correct
                every tile during review.
              </AppText>
            ) : null}
            {sensorError ? (
              <AppText style={styles.warning}>{sensorError}</AppText>
            ) : null}
            {(draft?.tiles.length ?? 0) === 0 ? (
              <AppText tone="muted">
                Capture the first tile anywhere. One tile is a complete partial
                panorama.
              </AppText>
            ) : null}
            <ActionButton
              disabled={!cameraGranted}
              label="Capture tile"
              loading={busy}
              onPress={() => void captureTile()}
            />
            <ActionButton
              label="Import image"
              loading={busy}
              onPress={() => void importTile()}
              variant="secondary"
            />
            {!cameraGranted ? (
              <ActionButton
                label="Open system settings"
                onPress={() => void native.openSettings()}
                variant="text"
              />
            ) : null}
          </>
        ) : (
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
                  {selectedTile.sourceKind === 'import'
                    ? 'Manual placement'
                    : `${selectedTile.orientationConfidence} sensor confidence`}
                </AppText>
                <AppText>
                  {degrees(selectedTile.reviewedPlacement.centerAzimuthDegrees)}
                  {' az · '}
                  {degrees(
                    selectedTile.reviewedPlacement.centerAltitudeDegrees,
                  )}
                  {' alt · '}
                  {degrees(selectedTile.reviewedPlacement.rollDegrees)} roll
                </AppText>
                <AppText tone="muted">
                  Drag the selected tile for azimuth/altitude alignment, then
                  use the fine controls for exact correction.
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
                            altitudeDeltaDegrees:
                              altitudeDeltaDegrees as number,
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
              Saving accepts this partial coverage. Uncaptured directions are
              not assigned visibility until Stage 6 mask completion.
            </AppText>
            <ActionButton
              disabled={!draft?.tiles.length}
              label="Save panorama"
              loading={busy}
              onPress={() => void complete()}
            />
          </>
        )}
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
  cameraFallback: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 24,
  },
  cameraFallbackTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cameraFrame: {
    backgroundColor: colors.backdrop,
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    height: 390,
    overflow: 'hidden',
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
  reticle: {
    borderColor: colors.primary,
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    left: '50%',
    marginLeft: -24,
    marginTop: -24,
    position: 'absolute',
    top: '50%',
    width: 48,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sensorDetail: {
    color: colors.mutedText,
    fontSize: 11,
  },
  sensorPanel: {
    backgroundColor: 'rgba(5, 7, 13, 0.84)',
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    right: 10,
  },
  sensorValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  warning: {
    color: colors.warning,
  },
});
