import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import {
  panoramaStitchingController,
  type StitchedPreview,
  type StitchingController,
  type StitchingProgress,
} from '../panorama/panoramaStitching';
import { colors } from '../theme/tokens';
import { PanoramaPreview } from './PanoramaPreview';

const stageLabels: Record<StitchingProgress['stage'], string> = {
  reading: 'Preparing photos',
  matching: 'Matching details',
  aligning: 'Aligning photos',
  seams: 'Choosing seams',
  blending: 'Blending photos',
  writing: 'Finishing panorama',
};

export function PanoramaStitchingScreen({
  profileId,
  navigation,
  controller = panoramaStitchingController,
  renderPreview: Preview = PanoramaPreview,
  useReviewedPlacements = false,
}: {
  profileId: string;
  navigation: { backToCapture(): void; onAccepted(): void; manual(): void };
  controller?: StitchingController;
  renderPreview?: (props: { preview: StitchedPreview }) => React.ReactNode;
  useReviewedPlacements?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<StitchedPreview | null>(null);
  const [progress, setProgress] = useState<StitchingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    let result: StitchedPreview | null = null;
    const abort = new AbortController();
    cancelRef.current = abort;
    void controller
      .create(
        profileId,
        abort.signal,
        (value) => {
          if (active) setProgress(value);
        },
        useReviewedPlacements,
      )
      .then(
        (value) => {
          result = value;
          if (active) {
            setPreview(value);
            setWorking(false);
          } else void controller.discard(value).catch(() => undefined);
        },
        () => {
          if (active) {
            setError(
              'The photos could not be stitched. Your capture draft is safe.',
            );
            setWorking(false);
          }
        },
      );
    return () => {
      mountedRef.current = false;
      active = false;
      abort.abort();
      // A save owns its files until its transaction finishes.
      if (result && !savingRef.current)
        void controller.discard(result).catch(() => undefined);
    };
  }, [attempt, controller, profileId, useReviewedPlacements]);

  const leave = (destination: () => void) => {
    if (savingRef.current) return;
    cancelRef.current?.abort();
    destination();
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!savingRef.current) {
          cancelRef.current?.abort();
          navigation.backToCapture();
        }
        return true;
      },
    );
    return () => subscription.remove();
  }, [navigation]);

  const accept = async () => {
    if (!preview || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await controller.save(preview);
      await controller.discard(preview).catch(() => undefined);
      if (mountedRef.current) navigation.onAccepted();
    } catch {
      if (mountedRef.current)
        setError(
          'The panorama could not be saved. Your preview and photos remain available. Try again.',
        );
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
      else await controller.discard(preview).catch(() => undefined);
    }
  };

  const adjustManually = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      if (preview) await controller.prepareManual(preview);
      if (mountedRef.current) navigation.manual();
    } catch {
      if (mountedRef.current)
        setError(
          'The adjustments could not be opened. Your preview is safe. Try again.',
        );
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
      else if (preview)
        await controller.discard(preview).catch(() => undefined);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <AppText tone="title">
          {preview ? 'Review panorama' : 'Create panorama'}
        </AppText>
        <AppText tone="muted">
          {preview
            ? 'Drag to look around · pinch to zoom'
            : 'Your photos stay on this device.'}
        </AppText>
      </View>
      {preview ? (
        <Preview preview={preview} />
      ) : (
        <View style={styles.progress}>
          {working ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : null}
          {working ? (
            <AppText accessibilityLiveRegion="polite">
              {progress ? stageLabels[progress.stage] : 'Opening capture'}
              {progress && progress.total > 1
                ? ` · ${progress.completed + 1} / ${progress.total}`
                : ''}
            </AppText>
          ) : null}
        </View>
      )}
      <ScrollView
        style={styles.controls}
        contentContainerStyle={styles.controlsContent}
      >
        {preview?.unmatchedCount ? (
          <AppText tone="muted">
            {preview.unmatchedCount === 1
              ? '1 photo could not be matched'
              : `${preview.unmatchedCount} photos could not be matched`}
            . Measured positions were kept. Check their joins before continuing.
          </AppText>
        ) : null}
        {error ? (
          <AppText accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </AppText>
        ) : null}
        {preview ? (
          <ActionButton
            label="Use panorama"
            loading={saving}
            onPress={() => void accept()}
          />
        ) : null}
        {!working && !preview ? (
          <ActionButton
            label="Try again"
            onPress={() => {
              setError(null);
              setProgress(null);
              setWorking(true);
              setAttempt((value) => value + 1);
            }}
          />
        ) : null}
        <View style={styles.actions}>
          <ActionButton
            label="Back to camera"
            style={styles.secondaryAction}
            disabled={saving}
            onPress={() => leave(navigation.backToCapture)}
            variant="text"
          />
          {!working ? (
            <ActionButton
              label="Adjust manually"
              style={styles.secondaryAction}
              disabled={saving}
              onPress={() => void adjustManually()}
              variant="text"
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: 14, gap: 4 },
  progress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  controls: {
    flexGrow: 0,
    maxHeight: '45%',
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  controlsContent: { padding: 12, gap: 10 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  error: { color: colors.danger },
  secondaryAction: { flex: 1, minWidth: 130, paddingVertical: 8 },
});
