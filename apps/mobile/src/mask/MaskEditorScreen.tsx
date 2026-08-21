import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import type {
  ActiveMaskRevision,
  SaveMaskRevisionInput,
} from '../storage/maskRepository';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import { createLocalRecordId } from '../storage/recordIdentity';
import { colors, layout } from '../theme/tokens';
import { createMaskImageFile } from '../panorama/directionalAtlasImage';
import { DIRECTIONAL_ATLAS_PROJECTION } from '../panorama/directionalAtlas';
import { MaskEditorCanvas } from './MaskEditorCanvas';
import { BrushSizeControl } from './BrushSizeControl';
import {
  addMaskOperation,
  createMaskEditorHistory,
  type MaskEditorHistory,
} from './maskEditorHistory';
import {
  createVisibilityMask,
  type AngularPointDegrees,
  type VisibilityMask,
  type VisibilityMaskOperation,
} from './visibilityMask';
import {
  applyRasterMaskOperations,
  createBlockedBitsetFromCoverage,
  createMaskRgba,
} from './rasterMask';

export type MaskEditorTool = 'blockedStroke' | 'visibleStroke';

export interface MaskEditorData {
  activeMask: ActiveMaskRevision | null;
  panorama: ActivePanorama | null;
  profileName: string;
}

export interface MaskEditorController {
  load(profileId: string): Promise<MaskEditorData>;
  save(input: SaveMaskRevisionInput): Promise<void>;
}

export interface MaskEditorCanvasProps {
  activeTool: MaskEditorTool;
  brushDiameterPixels: number;
  mask: VisibilityMask;
  onCommitStroke(
    points: readonly AngularPointDegrees[],
    angularRadiusDegrees: number,
  ): void;
  panorama: ActivePanorama;
}

export const maskEditorController: MaskEditorController = {
  async load(profileId) {
    const storage = await bootstrapStorage();
    const [profile, panorama, activeMask] = await Promise.all([
      storage.profiles.getById(profileId),
      storage.panoramas.getActiveForProfile(profileId),
      storage.masks.getActiveForProfile(profileId),
    ]);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    return { activeMask, panorama, profileName: profile.name };
  },
  async save(input) {
    const storage = await bootstrapStorage();
    await storage.masks.saveRevision(input);
  },
};

const createInitialOperations = (): readonly VisibilityMaskOperation[] => [];

export function MaskEditorScreen({
  controller = maskEditorController,
  navigation,
  profileId,
  renderCanvas: Canvas = MaskEditorCanvas,
}: {
  controller?: MaskEditorController;
  navigation: { goBack(): void; onSaved(): void };
  profileId: string;
  renderCanvas?: (props: MaskEditorCanvasProps) => React.ReactNode;
}) {
  const [data, setData] = useState<MaskEditorData | null>(null);
  const [history, setHistory] = useState<MaskEditorHistory>(() =>
    createMaskEditorHistory(),
  );
  const [activeTool, setActiveTool] = useState<MaskEditorTool>('blockedStroke');
  const [brushDiameterPixels, setBrushDiameterPixels] = useState(32);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await controller.load(profileId);
      setData(loaded);
      setHistory(createMaskEditorHistory(createInitialOperations()));
    } catch {
      setError('The panorama and mask could not be read from this device.');
    } finally {
      setLoading(false);
    }
  }, [controller, profileId]);

  useEffect(() => {
    let active = true;
    void controller.load(profileId).then(
      (loaded) => {
        if (!active) return;
        setData(loaded);
        setHistory(createMaskEditorHistory(createInitialOperations()));
        setError(null);
        setLoading(false);
      },
      () => {
        if (!active) return;
        setError('The panorama and mask could not be read from this device.');
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [controller, profileId]);

  const activeRaster = data?.activeMask?.raster;
  const mask = useMemo(
    () => ({
      ...createVisibilityMask([], history.operations),
      ...(activeRaster ? { raster: activeRaster } : {}),
    }),
    [activeRaster, history.operations],
  );
  const hasCapturedCoverage = Boolean(
    data?.panorama?.uri &&
    data.panorama.coverageBitset &&
    data.panorama.widthPixels &&
    data.panorama.heightPixels,
  );

  const addOperation = (
    operation: Omit<
      Extract<
        VisibilityMaskOperation,
        { kind: 'blockedStroke' | 'visibleStroke' }
      >,
      'id'
    >,
  ) =>
    setHistory((current) =>
      addMaskOperation(current, {
        ...operation,
        id: createLocalRecordId('mask-operation'),
      } as VisibilityMaskOperation),
    );

  const save = async () => {
    if (
      !data?.panorama?.coverageBitset ||
      !data.panorama.widthPixels ||
      !data.panorama.heightPixels ||
      !hasCapturedCoverage
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const initialBlocked = data.activeMask?.raster?.blockedBitset
        ? data.activeMask.raster.blockedBitset
        : createBlockedBitsetFromCoverage(
            data.panorama.coverageBitset,
            data.panorama.widthPixels,
            data.panorama.heightPixels,
          );
      const blockedBitset = applyRasterMaskOperations(
        initialBlocked,
        data.panorama.coverageBitset,
        data.panorama.widthPixels,
        data.panorama.heightPixels,
        history.operations,
      );
      const temporaryUri = createMaskImageFile(
        createMaskRgba(
          blockedBitset,
          data.panorama.widthPixels,
          data.panorama.heightPixels,
        ),
        data.panorama.widthPixels,
        data.panorama.heightPixels,
      );
      await controller.save({
        blockedBitset,
        id: createLocalRecordId('mask'),
        profileId,
        panoramaRevisionId: data.panorama.id,
        createdAtUtc: new Date().toISOString(),
        heightPixels: data.panorama.heightPixels,
        projection: DIRECTIONAL_ATLAS_PROJECTION,
        temporaryUri,
        widthPixels: data.panorama.widthPixels,
      });
      setConfirmationVisible(false);
      navigation.onSaved();
    } catch {
      setError(
        'The mask could not be saved. Your edits remain available; try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <AppText tone="muted">Loading directional panorama…</AppText>
      </SafeAreaView>
    );
  }
  if (!data || (error && !data)) {
    return (
      <SafeAreaView style={styles.centered}>
        <AppText tone="title">Mask editor unavailable</AppText>
        <AppText tone="muted">{error}</AppText>
        <ActionButton label="Try again" onPress={() => void load()} />
        <ActionButton label="Back" onPress={navigation.goBack} variant="text" />
      </SafeAreaView>
    );
  }
  if (!data.panorama) {
    return (
      <SafeAreaView style={styles.centered}>
        <AppText tone="title">Panorama required</AppText>
        <AppText tone="muted">
          Capture and save a panorama first, then mark its visible sky.
        </AppText>
        <ActionButton label="Back to Sky View" onPress={navigation.goBack} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <AppText tone="title">
            {data.activeMask ? 'Edit obstacle mask' : 'Paint obstacles'}
          </AppText>
          <AppText numberOfLines={1} tone="muted">
            {data.profileName} · paint obstacles red · two fingers move
          </AppText>
        </View>
        <ActionButton label="Back" onPress={navigation.goBack} variant="text" />
      </View>

      <Canvas
        activeTool={activeTool}
        brushDiameterPixels={brushDiameterPixels}
        mask={mask}
        onCommitStroke={(points, angularRadiusDegrees) => {
          addOperation({
            kind: activeTool,
            angularRadiusDegrees,
            points,
          });
        }}
        panorama={data.panorama}
      />

      <View style={styles.controls}>
        <View style={styles.toolRow}>
          <ActionButton
            label="Draw"
            onPress={() => setActiveTool('blockedStroke')}
            style={styles.toolButton}
            variant={activeTool === 'blockedStroke' ? 'primary' : 'secondary'}
          />
          <ActionButton
            label="Erase"
            onPress={() => setActiveTool('visibleStroke')}
            style={styles.toolButton}
            variant={activeTool === 'visibleStroke' ? 'primary' : 'secondary'}
          />
        </View>
        <BrushSizeControl
          onChange={setBrushDiameterPixels}
          valuePixels={brushDiameterPixels}
        />
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        <ActionButton
          disabled={!hasCapturedCoverage}
          label="Complete mask"
          onPress={() => setConfirmationVisible(true)}
        />
      </View>

      <ModalSheet
        closeAccessibilityLabel="Close mask completion warning"
        onClose={() => setConfirmationVisible(false)}
        title="Complete binary mask?"
        visible={confirmationVisible}
      >
        <AppText>
          Painted obstacles and uncaptured directions will be blocked. The saved
          mask is one neutral binary image and can be edited later.
        </AppText>
        <ActionButton
          label="Save binary mask"
          loading={saving}
          onPress={() => void save()}
        />
        <ActionButton
          label="Keep editing"
          onPress={() => setConfirmationVisible(false)}
          variant="secondary"
        />
      </ModalSheet>
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
  controls: { gap: 8, padding: 10 },
  error: { color: colors.danger },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headingCopy: { flex: 1 },
  screen: { backgroundColor: colors.background, flex: 1 },
  toolButton: { flex: 1, minWidth: 82 },
  toolRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
});
