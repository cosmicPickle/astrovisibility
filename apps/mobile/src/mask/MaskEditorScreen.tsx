import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { createTileCoveragePolygon } from '../panorama/tileGeometry';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import type {
  ActiveMaskRevision,
  SaveMaskRevisionInput,
} from '../storage/maskRepository';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import { createLocalRecordId } from '../storage/recordIdentity';
import { colors, layout } from '../theme/tokens';
import { MaskEditorCanvas } from './MaskEditorCanvas';
import {
  addMaskOperation,
  createMaskEditorHistory,
  redoMaskEdit,
  removeMaskOperation,
  resetMaskOperations,
  undoMaskEdit,
  type MaskEditorHistory,
} from './maskEditorHistory';
import {
  createVisibilityMask,
  type AngularPointDegrees,
  type VisibilityMask,
  type VisibilityMaskOperation,
} from './visibilityMask';

export type MaskEditorTool =
  'blockedStroke' | 'pan' | 'visiblePolygon' | 'visibleStroke';

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
  brushRadiusDegrees: number;
  mask: VisibilityMask;
  onCommitPolygon(points: readonly AngularPointDegrees[]): void;
  onCommitStroke(points: readonly AngularPointDegrees[]): void;
  operations: readonly VisibilityMaskOperation[];
  panorama: ActivePanorama;
  showMaskPreview: boolean;
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

const operationLabel = (operation: VisibilityMaskOperation, index: number) => {
  if (operation.kind === 'visiblePolygon') return `Visible region ${index + 1}`;
  return `${operation.kind === 'blockedStroke' ? 'Blocked' : 'Visible'} correction ${index + 1}`;
};

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
  const [activeTool, setActiveTool] = useState<MaskEditorTool>('pan');
  const [brushRadiusDegrees, setBrushRadiusDegrees] = useState(0.25);
  const [showMaskPreview, setShowMaskPreview] = useState(true);
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
      setHistory(createMaskEditorHistory(loaded.activeMask?.operations ?? []));
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
        setHistory(
          createMaskEditorHistory(loaded.activeMask?.operations ?? []),
        );
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

  const coveragePolygons = useMemo(
    () =>
      data?.activeMask?.coveragePolygons ??
      data?.panorama?.tiles.map((tile) =>
        createTileCoveragePolygon({
          centerAltitudeDegrees: tile.centerAltitudeDegrees,
          centerAzimuthDegrees: tile.centerAzimuthDegrees,
          horizontalFieldOfViewDegrees: tile.horizontalFieldOfViewDegrees,
          verticalFieldOfViewDegrees: tile.verticalFieldOfViewDegrees,
        }),
      ) ??
      [],
    [data],
  );
  const mask = useMemo(
    () => createVisibilityMask(coveragePolygons, history.operations),
    [coveragePolygons, history.operations],
  );
  const hasVisibleRegion = history.operations.some(
    ({ kind }) => kind === 'visiblePolygon',
  );

  const addOperation = (
    operation:
      | Omit<Extract<VisibilityMaskOperation, { kind: 'visiblePolygon' }>, 'id'>
      | Omit<
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
    if (!data?.panorama || !hasVisibleRegion) return;
    setSaving(true);
    setError(null);
    try {
      await controller.save({
        id: createLocalRecordId('mask'),
        profileId,
        panoramaRevisionId: data.panorama.id,
        createdAtUtc: new Date().toISOString(),
        operations: history.operations,
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
            {data.activeMask ? 'Edit visibility mask' : 'Draw visibility mask'}
          </AppText>
          <AppText numberOfLines={1} tone="muted">
            {data.profileName} · everything unmarked is blocked
          </AppText>
        </View>
        <ActionButton label="Back" onPress={navigation.goBack} variant="text" />
      </View>

      <Canvas
        activeTool={activeTool}
        brushRadiusDegrees={brushRadiusDegrees}
        mask={mask}
        onCommitPolygon={(points) =>
          addOperation({ kind: 'visiblePolygon', points })
        }
        onCommitStroke={(points) => {
          if (activeTool !== 'blockedStroke' && activeTool !== 'visibleStroke')
            return;
          addOperation({
            kind: activeTool,
            angularRadiusDegrees: brushRadiusDegrees,
            points,
          });
        }}
        operations={history.operations}
        panorama={data.panorama}
        showMaskPreview={showMaskPreview}
      />

      <ScrollView
        contentContainerStyle={styles.controls}
        horizontal
        showsHorizontalScrollIndicator
        style={styles.toolScroller}
      >
        <ActionButton
          label="Pan / zoom"
          onPress={() => setActiveTool('pan')}
          variant={activeTool === 'pan' ? 'primary' : 'secondary'}
        />
        <ActionButton
          label="Mark visible sky"
          onPress={() => setActiveTool('visiblePolygon')}
          variant={activeTool === 'visiblePolygon' ? 'primary' : 'secondary'}
        />
        <ActionButton
          label="Blocked brush"
          onPress={() => setActiveTool('blockedStroke')}
          variant={activeTool === 'blockedStroke' ? 'primary' : 'secondary'}
        />
        <ActionButton
          label="Visible brush"
          onPress={() => setActiveTool('visibleStroke')}
          variant={activeTool === 'visibleStroke' ? 'primary' : 'secondary'}
        />
      </ScrollView>
      <View style={styles.actionRows}>
        <View style={styles.compactRow}>
          <ActionButton
            disabled={history.undoStack.length === 0}
            label="Undo"
            onPress={() => setHistory(undoMaskEdit)}
            variant="secondary"
          />
          <ActionButton
            disabled={history.redoStack.length === 0}
            label="Redo"
            onPress={() => setHistory(redoMaskEdit)}
            variant="secondary"
          />
          <ActionButton
            disabled={history.operations.length === 0}
            label="Reset"
            onPress={() => setHistory(resetMaskOperations)}
            variant="danger"
          />
          <ActionButton
            label={showMaskPreview ? 'Before' : 'After'}
            onPress={() => setShowMaskPreview((current) => !current)}
            variant="secondary"
          />
        </View>
        {activeTool === 'blockedStroke' || activeTool === 'visibleStroke' ? (
          <View style={styles.compactRow}>
            <AppText tone="label">
              Brush {brushRadiusDegrees.toFixed(2)}°
            </AppText>
            {[0.05, 0.25, 1].map((radius) => (
              <ActionButton
                key={radius}
                label={`${radius}°`}
                onPress={() => setBrushRadiusDegrees(radius)}
                variant={
                  brushRadiusDegrees === radius ? 'primary' : 'secondary'
                }
              />
            ))}
          </View>
        ) : null}
        {history.operations.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            style={styles.operationScroller}
          >
            <View style={styles.compactRow}>
              {history.operations.map((operation, index) => (
                <ActionButton
                  accessibilityLabel={`Remove ${operationLabel(operation, index).toLowerCase()}`}
                  key={operation.id}
                  label={`Remove · ${operationLabel(operation, index)}`}
                  onPress={() =>
                    setHistory((current) =>
                      removeMaskOperation(current, operation.id),
                    )
                  }
                  variant="secondary"
                />
              ))}
            </View>
          </ScrollView>
        ) : null}
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        {!hasVisibleRegion ? (
          <AppText tone="muted">
            Close at least one visible region before completion.
          </AppText>
        ) : null}
        <ActionButton
          disabled={!hasVisibleRegion}
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
          All unmarked and uncaptured directions will be blocked. You can edit
          this mask later without replacing the panorama.
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
  actionRows: { gap: 8, padding: 10 },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: layout.sectionGap,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  compactRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  controls: { gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  error: { color: colors.danger },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headingCopy: { flex: 1 },
  operationScroller: { flexGrow: 0, maxHeight: 60 },
  screen: { backgroundColor: colors.background, flex: 1 },
  toolScroller: { flexGrow: 0, maxHeight: 60 },
});
