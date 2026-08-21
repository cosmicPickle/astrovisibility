import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import type { PanoramaCaptureDraft } from '../storage/panoramaDraftRepository';
import { createLocalRecordId } from '../storage/recordIdentity';
import { createDirectionalPanoramaImage } from '../panorama/directionalAtlasImage';
import { colors, layout } from '../theme/tokens';
import { applyTileCorrection, type CapturedProofTile } from './captureSession';
import { PanoramaAlignmentAtlas } from './PanoramaAlignmentAtlas';
import { TileNudgeControl } from './TileNudgeControl';

export interface PanoramaAlignmentAtlasProps {
  onSelectTile(tileId: string): void;
  selectedTileId: string | null;
  tiles: PanoramaCaptureDraft['tiles'];
}

export interface PanoramaAlignmentController {
  load(
    profileId: string,
  ): Promise<{ draft: PanoramaCaptureDraft | null; profileName: string }>;
  updateTilePlacement(
    draftId: string,
    tileId: string,
    placement: CapturedProofTile['reviewedPlacement'],
  ): Promise<PanoramaCaptureDraft>;
  completeDraft(draftId: string): Promise<void>;
}

export const panoramaAlignmentController: PanoramaAlignmentController = {
  async load(profileId) {
    const storage = await bootstrapStorage();
    const [profile, draft] = await Promise.all([
      storage.profiles.getById(profileId),
      storage.panoramas.getForProfile(profileId),
    ]);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    return { draft, profileName: profile.name };
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
  async completeDraft(draftId) {
    const storage = await bootstrapStorage();
    const draft = await storage.panoramas.getById(draftId);
    if (!draft) throw new Error('The panorama draft could not be reopened.');
    const asset = await createDirectionalPanoramaImage(draft);
    await storage.panoramas.complete(
      draftId,
      createLocalRecordId('panorama'),
      new Date().toISOString(),
      asset,
    );
  },
};

export function PanoramaAlignmentScreen({
  controller = panoramaAlignmentController,
  navigation,
  profileId,
  renderAtlas: Atlas = PanoramaAlignmentAtlas,
}: {
  controller?: PanoramaAlignmentController;
  navigation: { backToCapture(): void; onAccepted(): void };
  profileId: string;
  renderAtlas?: (props: PanoramaAlignmentAtlasProps) => React.ReactNode;
}) {
  const [draft, setDraft] = useState<PanoramaCaptureDraft | null>(null);
  const [profileName, setProfileName] = useState('');
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await controller.load(profileId);
      setDraft(result.draft);
      setProfileName(result.profileName);
      setSelectedTileId(result.draft?.tiles[0]?.id ?? null);
    } catch {
      setError('The panorama draft could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [controller, profileId]);

  useEffect(() => {
    let active = true;
    void controller.load(profileId).then(
      (result) => {
        if (!active) return;
        setDraft(result.draft);
        setProfileName(result.profileName);
        setSelectedTileId(result.draft?.tiles[0]?.id ?? null);
        setError(null);
        setLoading(false);
      },
      () => {
        if (!active) return;
        setError('The panorama draft could not be opened.');
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [controller, profileId]);

  const selectedTile =
    draft?.tiles.find(({ id }) => id === selectedTileId) ?? null;
  const nudge = async (
    azimuthDeltaDegrees: number,
    altitudeDeltaDegrees: number,
  ) => {
    if (!draft || !selectedTile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const corrected = applyTileCorrection(selectedTile, {
        altitudeDeltaDegrees,
        azimuthDeltaDegrees,
        rollDeltaDegrees: 0,
      });
      setDraft(
        await controller.updateTilePlacement(
          draft.id,
          selectedTile.id,
          corrected.reviewedPlacement,
        ),
      );
    } catch {
      setError('The tile position could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  const accept = async () => {
    if (!draft || draft.tiles.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await controller.completeDraft(draft.id);
      navigation.onAccepted();
    } catch {
      setError(
        'The panorama could not be created. Your aligned tiles remain available.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }
  if (!draft || draft.tiles.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <AppText tone="title">No tiles to align</AppText>
        <AppText tone="muted">
          Capture at least one panorama tile first.
        </AppText>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        {error ? (
          <ActionButton label="Try again" onPress={() => void load()} />
        ) : null}
        <ActionButton
          label="Back to camera"
          onPress={navigation.backToCapture}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText tone="title">Align tiles</AppText>
          <AppText numberOfLines={1} tone="muted">
            {profileName} · drag to look · pinch to zoom · tap a tile
          </AppText>
        </View>
        <ActionButton
          label="Back to camera"
          onPress={navigation.backToCapture}
          variant="text"
        />
      </View>
      <Atlas
        onSelectTile={setSelectedTileId}
        selectedTileId={selectedTileId}
        tiles={draft.tiles}
      />
      <View style={styles.controls}>
        <View style={styles.selectionCopy}>
          <AppText tone="label">
            {selectedTile
              ? `Tile ${draft.tiles.findIndex(({ id }) => id === selectedTile.id) + 1} selected`
              : 'Tap a tile to select it'}
          </AppText>
          <AppText tone="muted">
            Move the selected photo one degree per press.
          </AppText>
        </View>
        <TileNudgeControl
          disabled={!selectedTile || busy}
          onDown={() => void nudge(0, -1)}
          onLeft={() => void nudge(-1, 0)}
          onRight={() => void nudge(1, 0)}
          onUp={() => void nudge(0, 1)}
        />
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        <ActionButton
          label="Use panorama"
          loading={busy}
          onPress={() => void accept()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: layout.sectionGap,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  controls: {
    alignItems: 'center',
    borderTopColor: colors.outline,
    borderTopWidth: 1,
    gap: 8,
    padding: 10,
  },
  error: { color: colors.danger },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, padding: 10 },
  headerCopy: { flex: 1 },
  screen: { backgroundColor: colors.background, flex: 1 },
  selectionCopy: { alignItems: 'center' },
});
