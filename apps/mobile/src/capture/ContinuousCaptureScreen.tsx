import { Camera, type CameraView } from 'expo-camera';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { createLocalRecordId } from '../storage/recordIdentity';
import type { PanoramaCaptureDraft } from '../storage/panoramaDraftRepository';
import { colors } from '../theme/tokens';
import { createCapturedTile } from './captureSession';
import { correctContinuousPose } from './continuousCapturePose';
import {
  devicePoseToOrientationSnapshot,
  devicePoseToReviewedPlacement,
} from './devicePose';
import { createTileCoveragePolygon } from '../panorama/tileGeometry';
import {
  NativeContinuousCamera,
  type ContinuousFrame,
  type ContinuousTracking,
} from './NativeContinuousCamera';
import {
  panoramaCaptureController,
  type PanoramaCaptureController,
} from './PanoramaCaptureScreen';
import { PoseDrivenCaptureView } from './PoseDrivenCaptureView';
import { PanoramaRecordButton } from './PanoramaRecordButton';
import { useDevicePose } from './useDevicePose';

const trackingMessages: Record<string, string> = {
  tracking:
    'Move slowly left, right or upward. Return over captured areas anytime.',
  detail:
    'Hold steady and aim at a detailed edge. This view has too little sharp detail.',
  lost: 'Return slowly to a captured area to recover alignment.',
  horizon: 'Aim the camera center at or above the horizon.',
  capacity:
    'Capture limit reached. Tap the stop button to create your panorama.',
  sensor: 'Acquiring phone direction. Move away from metal if this persists.',
  error:
    'Camera processing paused. Tap the record button to retry, or start over with a new draft.',
};

export function ContinuousCaptureScreen({
  profileId,
  navigation,
  controller = panoramaCaptureController,
}: {
  profileId: string;
  navigation: { goBack(): void; onAlign?(): void; onSaved(): void };
  controller?: PanoramaCaptureController;
}) {
  const [loaded, setLoaded] = useState<Awaited<
    ReturnType<PanoramaCaptureController['load']>
  > | null>(null);
  const [draft, setDraft] = useState<PanoramaCaptureDraft | null>(null);
  const draftRef = useRef(draft);
  const [granted, setGranted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<ContinuousTracking | null>(null);
  const [correction, setCorrection] =
    useState<Parameters<typeof correctContinuousPose>[1]>(null);
  const [acknowledgement, setAcknowledgement] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [initialTiles, setInitialTiles] = useState('[]');
  const pendingSave = useRef<Promise<void>>(Promise.resolve());
  const saveFailed = useRef(false);
  const operation = useRef<'starting' | 'stitch' | 'back' | null>(null);
  const mounted = useRef(true);
  const recordingRef = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const device = useDevicePose(granted, loaded?.profile ?? null);
  const observer = useMemo(
    () => ({
      latitudeDegreesNorth: loaded?.profile.latitudeDegreesNorth ?? 0,
      longitudeDegreesEast: loaded?.profile.longitudeDegreesEast ?? 0,
      elevationMetersAboveMeanSeaLevel:
        loaded?.profile.elevationMetersAboveMeanSeaLevel ?? 0,
    }),
    [loaded],
  );

  const pause = () => {
    recordingRef.current = false;
    setRecording(false);
    operation.current = null;
    setBusy(false);
  };
  useEffect(() => {
    mounted.current = true;
    void controller.load(profileId).then(
      (value) => {
        if (!mounted.current) return;
        setLoaded(value);
        setDraft(value.draft);
        draftRef.current = value.draft;
        setInitialTiles(JSON.stringify(value.draft?.tiles ?? []));
      },
      () => {
        if (mounted.current)
          setError('The local capture could not be opened. Go back and retry.');
      },
    );
    const refresh = () => {
      void Camera.getCameraPermissionsAsync().then(
        (value) => {
          if (mounted.current) setGranted(value.granted);
        },
        () => {
          if (mounted.current) setGranted(false);
        },
      );
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
      else if (recordingRef.current) {
        pause();
        setError(
          'Capture paused. Saved images are safe. Tap the record button to continue.',
        );
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [controller, profileId]);

  const saveFrame = (frame: ContinuousFrame) => {
    if (!mounted.current) return;
    pendingSave.current = pendingSave.current
      .then(async () => {
        const current = draftRef.current;
        if (!current) throw new Error('Missing draft');
        const captured = createCapturedTile({
          id: createLocalRecordId('tile'),
          uri: frame.uri,
          widthPixels: frame.widthPixels,
          heightPixels: frame.heightPixels,
          capturedAtUtc: new Date().toISOString(),
          orientation: devicePoseToOrientationSnapshot(frame.sensorPose),
          horizontalFieldOfViewDegrees: frame.horizontalDegrees,
          verticalFieldOfViewDegrees: frame.verticalDegrees,
          sourceKind: 'camera',
          motionAvailable: true,
        });
        const placement = devicePoseToReviewedPlacement(frame.pose, {
          horizontalDegrees: frame.horizontalDegrees,
          verticalDegrees: frame.verticalDegrees,
        });
        const tile = {
          ...captured,
          reviewedPlacement: placement,
          coveragePolygon: createTileCoveragePolygon(placement),
        };
        const updated = await controller.addTile(current.id, {
          ...tile,
          temporaryUri: frame.uri,
          fileExtension: 'jpg',
        });
        draftRef.current = updated;
        if (mounted.current) {
          setDraft(updated);
          setAcknowledgement(frame.sequence);
        }
      })
      .catch(() => {
        saveFailed.current = true;
        if (mounted.current) {
          pause();
          setAcknowledgement(-frame.sequence);
          setError(
            'This image could not be saved. Saved images are safe. Free some space and tap the record button to retry.',
          );
        }
      });
  };
  const stopped = async () => {
    await pendingSave.current;
    if (
      !mounted.current ||
      !operation.current ||
      operation.current === 'starting'
    )
      return;
    const destination = operation.current;
    operation.current = null;
    setBusy(false);
    if (destination === 'back') {
      navigation.goBack();
      return;
    }
    if (saveFailed.current) return;
    if (!draftRef.current?.tiles.length) {
      setError(
        'No sharp, aligned images captured yet. Tap the record button and aim at detailed surroundings.',
      );
      return;
    }
    navigation.onAlign?.();
  };
  const stop = (destination: 'stitch' | 'back') => {
    if (operation.current) return;
    operation.current = destination;
    setBusy(true);
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
    } else void stopped();
  };
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      stop('back');
      return true;
    });
    return () => listener.remove();
  });
  const start = async () => {
    if (operation.current || recordingRef.current) return;
    operation.current = 'starting';
    setBusy(true);
    setError(null);
    try {
      // Re-requesting an already granted permission still launches Android's
      // permission activity on some devices, interrupting the native camera.
      const permission = granted
        ? { granted: true }
        : await Camera.requestCameraPermissionsAsync();
      if (!mounted.current || operation.current !== 'starting') return;
      setGranted(permission.granted);
      if (!permission.granted) {
        setError(
          'Camera access is needed to capture your surroundings. Enable it in system settings.',
        );
        return;
      }
      if (AppState.currentState && AppState.currentState !== 'active') {
        setError(
          'Camera ready. Return to the app and tap the record button to begin.',
        );
        return;
      }
      const current =
        draftRef.current ?? (await controller.createDraft(profileId));
      if (!mounted.current || operation.current !== 'starting') return;
      draftRef.current = current;
      setDraft(current);
      saveFailed.current = false;
      recordingRef.current = true;
      setRecording(true);
    } catch {
      if (mounted.current)
        setError('Capture could not start. Your saved draft is safe.');
    } finally {
      if (mounted.current) {
        operation.current = null;
        setBusy(false);
      }
    }
  };
  const reset = async () => {
    if (recordingRef.current || operation.current) return;
    setBusy(true);
    try {
      await pendingSave.current;
      if (draftRef.current) await controller.discardDraft(draftRef.current.id);
      draftRef.current = null;
      setDraft(null);
      setInitialTiles('[]');
      setGeneration((value) => value + 1);
      setAcknowledgement(0);
      setTracking(null);
      setCorrection(null);
      setConfirmReset(false);
      setError(null);
    } catch {
      setError('The draft could not be removed. Your images remain safe.');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded || loaded.activePanorama)
    return (
      <SafeAreaView style={styles.centered}>
        {loaded?.activePanorama ? (
          <AppText>
            Delete the existing panorama/mask pair before capturing again.
          </AppText>
        ) : error ? (
          <AppText>{error}</AppText>
        ) : (
          <ActivityIndicator />
        )}
        <ActionButton label="Back" onPress={navigation.goBack} />
      </SafeAreaView>
    );
  const profile = loaded.profile;
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <AppText tone="label">Capture panorama</AppText>
          <AppText tone="muted">
            {draft?.tiles.length ?? 0} captured · stay at the observing position
          </AppText>
        </View>
        <ActionButton
          label="Back"
          disabled={busy}
          onPress={() => stop('back')}
          variant="text"
        />
      </View>
      <PoseDrivenCaptureView
        busy={busy}
        cameraGranted={granted}
        cameraRef={cameraRef}
        fieldOfView={
          tracking?.horizontalDegrees && tracking.verticalDegrees
            ? {
                horizontalDegrees: tracking.horizontalDegrees,
                verticalDegrees: tracking.verticalDegrees,
              }
            : device.fieldOfView
        }
        pose={
          correctContinuousPose(device.pose, correction) ??
          tracking?.pose ??
          null
        }
        poseError={null}
        poseReadiness="ready"
        profile={profile}
        tiles={draft?.tiles ?? []}
        onCapture={() => void start()}
        onFinish={() => stop('stitch')}
        onOpenSettings={() => void Linking.openSettings()}
        statusText={
          error ??
          (recording
            ? trackingMessages[tracking?.status ?? 'sensor']
            : 'Tap the record button, then move slowly left, right or upward. Tap stop when finished.')
        }
        previewOverride={
          <NativeContinuousCamera
            testID="continuous-camera"
            key={generation}
            style={StyleSheet.absoluteFill}
            recording={recording}
            observer={observer}
            acknowledgement={acknowledgement}
            initialTiles={initialTiles}
            onFrame={(event) => saveFrame(event.nativeEvent)}
            onStopped={() => void stopped()}
            onInterruption={() => {
              pause();
              setError(
                'Capture paused. Saved images are safe. Tap the record button to continue.',
              );
            }}
            onTracking={(event) => {
              setTracking(event.nativeEvent);
              const { status, pose, sensorPose } = event.nativeEvent;
              if (status === 'tracking' && pose && sensorPose)
                setCorrection({ sensor: sensorPose, tracked: pose });
              if (event.nativeEvent.status === 'error') {
                pause();
                setError(trackingMessages.error);
              }
            }}
          />
        }
        actionsOverride={
          <View style={styles.actions}>
            <PanoramaRecordButton
              recording={recording}
              busy={busy}
              onPress={() => (recording ? stop('stitch') : void start())}
            />
            {!recording && draft?.tiles.length ? (
              <>
                <ActionButton
                  label="Create panorama"
                  disabled={busy}
                  onPress={() => stop('stitch')}
                  variant="secondary"
                />
                <ActionButton
                  label="Start over"
                  disabled={busy}
                  onPress={() => setConfirmReset(true)}
                  variant="text"
                />
              </>
            ) : null}
          </View>
        }
      />
      <ModalSheet
        closeAccessibilityLabel="Keep capture"
        visible={confirmReset}
        title="Start a new panorama?"
        onClose={() => setConfirmReset(false)}
      >
        <AppText>
          This removes the current draft and its captured images from this
          device.
        </AppText>
        <ActionButton
          label="Discard and start over"
          loading={busy}
          onPress={() => void reset()}
          variant="danger"
        />
      </ModalSheet>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 12,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copy: { flex: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
});
