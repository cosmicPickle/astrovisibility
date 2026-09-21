import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { FormField } from '../components/ui/FormField';
import { ModalSheet } from '../components/ui/ModalSheet';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import { atlasPixelToDirection } from '../panorama/directionalAtlas';
import {
  horizontalDirectionToVector,
  vectorToHorizontalDirection,
} from '../sky/planetariumProjection';
import { colors } from '../theme/tokens';
import {
  createInitialWindow,
  createWindowGeometry,
  type WindowDefinition,
} from './windowGeometry';
import {
  WindowEditorCanvas,
  type WindowEditorCanvasProps,
} from './WindowEditorCanvas';

interface EditorData {
  panorama: ActivePanorama | null;
  definition: WindowDefinition | null;
  hasMask: boolean;
}
export interface WindowEditorController {
  load(profileId: string): Promise<EditorData>;
  save(
    profileId: string,
    panoramaId: string,
    definition: WindowDefinition,
  ): Promise<void>;
  remove(profileId: string, panoramaId: string): Promise<void>;
}
const controllerDefault: WindowEditorController = {
  async load(profileId) {
    const storage = await bootstrapStorage();
    const [panorama, definition, mask] = await Promise.all([
      storage.panoramas.getActiveForProfile(profileId),
      storage.windows.getForProfile(profileId),
      storage.database.getFirstAsync<{ id: string }>(
        "SELECT m.id FROM profiles p JOIN mask_revisions m ON m.id = p.active_mask_revision_id AND m.panorama_revision_id = p.active_panorama_revision_id WHERE p.id = ? AND m.status = 'complete'",
        [profileId],
      ),
    ]);
    return { panorama, definition, hasMask: Boolean(mask) };
  },
  async save(profileId, panoramaId, definition) {
    await (
      await bootstrapStorage()
    ).windows.save(profileId, panoramaId, definition);
  },
  async remove(profileId, panoramaId) {
    await (await bootstrapStorage()).windows.remove(profileId, panoramaId);
  },
};

function initialDefinition(panorama: ActivePanorama): WindowDefinition {
  const sum = { x: 0, y: 0, z: 0 };
  if (
    panorama.widthPixels &&
    panorama.heightPixels &&
    panorama.coverageBitset
  ) {
    const size = {
      widthPixels: panorama.widthPixels,
      heightPixels: panorama.heightPixels,
    };
    const step = Math.max(
      1,
      Math.floor(Math.min(size.widthPixels, size.heightPixels) / 64),
    );
    for (let y = 0; y < size.heightPixels; y += step)
      for (let x = 0; x < size.widthPixels; x += step) {
        const index = y * size.widthPixels + x;
        if (!(panorama.coverageBitset[index >> 3]! & (1 << (index & 7))))
          continue;
        const direction = atlasPixelToDirection(
          { xPixels: x, yPixels: y },
          size,
        );
        if (direction) {
          const ray = horizontalDirectionToVector(direction);
          sum.x += ray.x;
          sum.y += ray.y;
          sum.z += ray.z;
        }
      }
  }
  return createInitialWindow(
    Math.hypot(sum.x, sum.y, sum.z) > 1e-6
      ? vectorToHorizontalDirection(sum)
      : { azimuthDegrees: 0, altitudeDegrees: 30 },
  );
}

export function WindowEditorScreen({
  profileId,
  navigation,
  controller = controllerDefault,
  creation = false,
  renderCanvas: EditorCanvas = WindowEditorCanvas,
}: {
  profileId: string;
  navigation: { goBack(): void; onSaved(): void };
  controller?: WindowEditorController;
  creation?: boolean;
  renderCanvas?: (props: WindowEditorCanvasProps) => React.ReactNode;
}) {
  const [data, setData] = useState<EditorData | null>(null);
  const [draft, setDraft] = useState<WindowDefinition | null>(null);
  const [width, setWidth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(!creation);
  const [help, setHelp] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  useEffect(() => {
    let active = true;
    void controller.load(profileId).then(
      (loaded) => {
        if (!active) return;
        setData(loaded);
        setDraft(
          loaded.definition ??
            (loaded.panorama ? initialDefinition(loaded.panorama) : null),
        );
        setWidth(
          loaded.definition
            ? String(Number((loaded.definition.widthMeters * 100).toFixed(3)))
            : '',
        );
        setError(null);
        setLoading(false);
      },
      () => {
        if (active) {
          setError('The window could not be opened. Try again.');
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [controller, profileId, attempt]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!busy) navigation.goBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [busy, navigation]);
  const commit = async (remove = false) => {
    if (busy || !draft || !data?.panorama) return;
    const updated = {
      ...draft,
      widthMeters: Number(width.trim().replace(',', '.')) / 100,
    };
    if (!remove) {
      if (
        !width.trim() ||
        !Number.isFinite(updated.widthMeters) ||
        updated.widthMeters < 0.01 ||
        updated.widthMeters > 100
      ) {
        setError('Enter a window width from 1 to 10,000 cm.');
        return;
      }
      try {
        createWindowGeometry(updated);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Check the corners and width.',
        );
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      if (remove) await controller.remove(profileId, data.panorama.id);
      else await controller.save(profileId, data.panorama.id, updated);
      navigation.onSaved();
    } catch {
      setError(
        'The window could not be saved. Your edits remain available; try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  if (!data?.panorama || !data.hasMask || !draft)
    return (
      <SafeAreaView style={styles.centered}>
        <AppText tone="title">Window setup unavailable</AppText>
        <AppText>
          {error ?? 'Create the panorama and complete its mask first.'}
        </AppText>
        {error ? (
          <ActionButton
            label="Try again"
            onPress={() => {
              setLoading(true);
              setAttempt((v) => v + 1);
            }}
          />
        ) : null}
        <ActionButton label="Back" onPress={navigation.goBack} />
      </SafeAreaView>
    );
  if (!started)
    return (
      <SafeAreaView style={styles.centered}>
        <AppText tone="title">Define a window?</AppText>
        <AppText>
          Your panorama and mask are saved. If you observe through a nearby
          window, add its corners and approximate width to improve visibility
          estimates.
        </AppText>
        <AppText tone="muted">
          Optional. You can do this later from the profile menu.
        </AppText>
        <ActionButton label="Define window" onPress={() => setStarted(true)} />
        <ActionButton
          label="Skip"
          onPress={navigation.goBack}
          variant="secondary"
        />
      </SafeAreaView>
    );
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <View style={styles.title}>
            <AppText tone="title">
              {data.definition ? 'Redefine window' : 'Define window'}
            </AppText>
            <AppText tone="muted">
              Drag inside corners · pan / pinch to look
            </AppText>
          </View>
          <ActionButton
            label="Cancel"
            variant="text"
            disabled={busy}
            onPress={navigation.goBack}
          />
        </View>
        <View style={keyboardVisible ? styles.keyboardCanvas : styles.canvas}>
          <EditorCanvas
            definition={draft}
            panorama={data.panorama}
            enabled={!busy && !help && !keyboardVisible}
            resetVersion={resetVersion}
            onChange={(value) => {
              setDraft(value);
              setError(null);
            }}
            onError={setError}
          />
        </View>
        <ScrollView
          style={styles.controls}
          contentContainerStyle={styles.controlContent}
          keyboardShouldPersistTaps="handled"
        >
          <FormField
            label="Approximate window width"
            unit="cm"
            inputMode="decimal"
            keyboardType="decimal-pad"
            value={width}
            editable={!busy}
            onChangeText={(value) => {
              setWidth(value);
              setError(null);
            }}
          />
          <AppText tone="muted">
            Newly revealed sky is assumed clear. Uncaptured directions stay
            blocked.
          </AppText>
          {error ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              {error}
            </AppText>
          ) : null}
          <ActionButton
            label="Save window"
            loading={busy}
            disabled={busy}
            onPress={() => void commit()}
          />
          <View style={styles.row}>
            <ActionButton
              label="Reset corners"
              variant="text"
              disabled={busy}
              onPress={() => {
                setResetVersion((v) => v + 1);
                setError(null);
              }}
            />
            <ActionButton
              label="Help"
              variant="text"
              onPress={() => setHelp(true)}
            />
            {data.definition ? (
              <ActionButton
                label="Remove window"
                variant="text"
                disabled={busy}
                onPress={() => void commit(true)}
              />
            ) : null}
          </View>
        </ScrollView>
        <ModalSheet
          title="Window approximation"
          visible={help}
          onClose={() => setHelp(false)}
          closeAccessibilityLabel="Close window help"
        >
          <AppText>
            Use the inside clear width. The connected corners describe one
            upright, flat rectangle; the right corners also adjust its
            perspective.
          </AppText>
          <AppText>
            The panorama should be captured with the phone lens above the
            telescope’s turning axis, at imaging-lens height. An existing
            panorama works only as closely as it matches that position.
          </AppText>
          <AppText>
            The rectangle replaces the window border in calculations. Masked
            obstacles inside it remain blocked. Background hidden behind its old
            edge is assumed clear within captured coverage. Wall thickness and
            other nearby objects are not corrected.
          </AppText>
          <AppText>
            Reset only changes this draft. Cancel keeps your saved window.
            Removing the window restores your original mask.
          </AppText>
        </ModalSheet>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  canvas: { flex: 1, minHeight: 180 },
  keyboardCanvas: { height: 100 },
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 16,
    backgroundColor: colors.background,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 6 },
  title: { flex: 1 },
  controls: { flexGrow: 0, flexShrink: 1, maxHeight: 285 },
  controlContent: { padding: 10, gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  error: { color: colors.danger },
});
