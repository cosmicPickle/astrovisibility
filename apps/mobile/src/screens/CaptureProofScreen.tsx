import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  applyTileCorrection,
  createCapturedTile,
  type CapturedProofTile,
} from '../capture/captureSession';
import { useCaptureOrientation } from '../capture/useCaptureOrientation';
import { CapturedTileMosaic } from '../components/capture/CapturedTileMosaic';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { SectionCard } from '../components/ui/SectionCard';
import { colors, layout } from '../theme/tokens';

type CaptureMode = 'primer' | 'camera' | 'review';

const formatDegrees = (value: number) => `${Math.round(value)}°`;

export const CaptureProofScreen = () => {
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mode, setMode] = useState<CaptureMode>('primer');
  const [foregroundLocationGranted, setForegroundLocationGranted] =
    useState(false);
  const [tiles, setTiles] = useState<CapturedProofTile[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const { motionAvailable, orientation, sensorError, setOrientation } =
    useCaptureOrientation(mode === 'camera', foregroundLocationGranted);

  const selectedTile = useMemo(
    () => tiles.find((tile) => tile.id === selectedTileId) ?? null,
    [selectedTileId, tiles],
  );

  const startCapture = async () => {
    setCaptureError(null);
    const cameraResult = await requestCameraPermission();
    if (!cameraResult.granted) {
      setCaptureError(
        'Camera permission denied. You can retry after changing the system permission; later product stages also provide image import.',
      );
      return;
    }
    const locationResult = await Location.requestForegroundPermissionsAsync();
    setForegroundLocationGranted(locationResult.granted);
    setMode('camera');
  };

  const captureTile = async () => {
    if (!camera.current || isCapturing) return;
    setCaptureError(null);
    setIsCapturing(true);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.35 });
      const tile = createCapturedTile({
        id: `tile-${Date.now()}`,
        uri: picture.uri,
        widthPixels: picture.width,
        heightPixels: picture.height,
        capturedAtUtc: new Date().toISOString(),
        orientation,
        // Stage 0 uses a conservative uncalibrated phone-camera estimate. A
        // physical-device spike must decide whether per-device calibration is
        // required before these values can become production metadata.
        horizontalFieldOfViewDegrees: 62,
        verticalFieldOfViewDegrees: 48,
      });
      setTiles((current) => [...current, tile]);
      setSelectedTileId(tile.id);
    } catch {
      setCaptureError('Capture failed without saving a tile. Please retry.');
    } finally {
      setIsCapturing(false);
    }
  };

  const correctSelectedTile = (
    correction: Parameters<typeof applyTileCorrection>[1],
  ) => {
    if (!selectedTileId) return;
    setTiles((current) =>
      current.map((tile) =>
        tile.id === selectedTileId
          ? applyTileCorrection(tile, correction)
          : tile,
      ),
    );
  };

  if (mode === 'primer') {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppText tone="title">Camera and orientation proof</AppText>
          <SectionCard>
            <AppText tone="label">Before permissions</AppText>
            <AppText>
              Camera access captures synthetic test surroundings only.
              Foreground location is requested only to estimate true north; no
              position is retained. Motion stays on-device and is sampled only
              while the preview is open.
            </AppText>
            <AppText tone="muted">
              Keep private surroundings out of development screenshots and
              delete the app after testing if a sensitive scene was captured.
            </AppText>
          </SectionCard>
          {captureError ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              {captureError}
            </AppText>
          ) : null}
          <ActionButton
            label="Continue and request access"
            onPress={startCapture}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <AppText tone="label">
              {mode === 'camera' ? 'Live capture' : 'Angular review'}
            </AppText>
            <AppText tone="muted">
              {tiles.length} tile{tiles.length === 1 ? '' : 's'} · 360° not
              required
            </AppText>
          </View>
          <ActionButton
            label={mode === 'camera' ? 'Review' : 'Camera'}
            onPress={() => setMode(mode === 'camera' ? 'review' : 'camera')}
            variant="secondary"
          />
        </View>

        {mode === 'camera' ? (
          <View style={styles.cameraFrame}>
            {cameraPermission?.granted ? (
              <CameraView
                facing="back"
                ref={camera}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View pointerEvents="none" style={styles.reticle} />
            <View style={styles.sensorPanel}>
              <AppText style={styles.sensorValue}>
                Az {formatDegrees(orientation.trueHeadingDegrees)} · Alt{' '}
                {formatDegrees(orientation.estimatedAltitudeDegrees)} · Roll{' '}
                {formatDegrees(orientation.rollDegrees)}
              </AppText>
              <AppText style={styles.sensorDetail}>
                Heading uncertainty{' '}
                {orientation.headingAccuracyDegrees === null
                  ? 'unknown'
                  : `≤${orientation.headingAccuracyDegrees}°`}
                {' · '}motion {motionAvailable ? 'active' : 'unavailable'}
              </AppText>
            </View>
          </View>
        ) : (
          <CapturedTileMosaic
            onSelectTile={setSelectedTileId}
            selectedTileId={selectedTileId}
            tiles={tiles}
          />
        )}

        {sensorError ? (
          <AppText accessibilityRole="alert" style={styles.warning}>
            {sensorError}
          </AppText>
        ) : null}
        {captureError ? (
          <AppText accessibilityRole="alert" style={styles.error}>
            {captureError}
          </AppText>
        ) : null}

        {mode === 'camera' ? (
          <>
            <View style={styles.adjustmentRow}>
              <ActionButton
                label="Alt −10°"
                onPress={() =>
                  setOrientation((current) => ({
                    ...current,
                    estimatedAltitudeDegrees: Math.max(
                      0,
                      current.estimatedAltitudeDegrees - 10,
                    ),
                  }))
                }
                variant="secondary"
              />
              <ActionButton
                label="Alt +10°"
                onPress={() =>
                  setOrientation((current) => ({
                    ...current,
                    estimatedAltitudeDegrees: Math.min(
                      90,
                      current.estimatedAltitudeDegrees + 10,
                    ),
                  }))
                }
                variant="secondary"
              />
            </View>
            <ActionButton
              disabled={isCapturing}
              label={isCapturing ? 'Capturing…' : 'Capture tile'}
              onPress={captureTile}
            />
          </>
        ) : selectedTile ? (
          <SectionCard>
            <AppText tone="label">Selected tile correction</AppText>
            <AppText tone="muted">
              Az{' '}
              {formatDegrees(
                selectedTile.reviewedPlacement.centerAzimuthDegrees,
              )}
              {' · '}Alt{' '}
              {formatDegrees(
                selectedTile.reviewedPlacement.centerAltitudeDegrees,
              )}
              {' · '}Roll{' '}
              {formatDegrees(selectedTile.reviewedPlacement.rollDegrees)}
            </AppText>
            <View style={styles.adjustmentRow}>
              <ActionButton
                label="Az −5°"
                onPress={() =>
                  correctSelectedTile({
                    azimuthDeltaDegrees: -5,
                    altitudeDeltaDegrees: 0,
                    rollDeltaDegrees: 0,
                  })
                }
                variant="secondary"
              />
              <ActionButton
                label="Az +5°"
                onPress={() =>
                  correctSelectedTile({
                    azimuthDeltaDegrees: 5,
                    altitudeDeltaDegrees: 0,
                    rollDeltaDegrees: 0,
                  })
                }
                variant="secondary"
              />
            </View>
            <View style={styles.adjustmentRow}>
              <ActionButton
                label="Alt −5°"
                onPress={() =>
                  correctSelectedTile({
                    azimuthDeltaDegrees: 0,
                    altitudeDeltaDegrees: -5,
                    rollDeltaDegrees: 0,
                  })
                }
                variant="secondary"
              />
              <ActionButton
                label="Alt +5°"
                onPress={() =>
                  correctSelectedTile({
                    azimuthDeltaDegrees: 0,
                    altitudeDeltaDegrees: 5,
                    rollDeltaDegrees: 0,
                  })
                }
                variant="secondary"
              />
            </View>
          </SectionCard>
        ) : (
          <SectionCard>
            <AppText tone="muted">
              Capture one tile for a valid partial mosaic, or several
              overlapping tiles. Set altitude near 90° to prove an upward tile.
            </AppText>
          </SectionCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  adjustmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cameraFrame: {
    backgroundColor: colors.backdrop,
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    height: 430,
    overflow: 'hidden',
  },
  content: {
    gap: layout.sectionGap,
    padding: layout.screenPadding,
  },
  error: {
    color: colors.danger,
  },
  headingCopy: {
    flex: 1,
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  reticle: {
    borderColor: colors.primary,
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    left: '50%',
    marginLeft: -22,
    marginTop: -22,
    position: 'absolute',
    top: '50%',
    width: 44,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sensorDetail: {
    color: colors.mutedText,
    fontSize: 12,
  },
  sensorPanel: {
    backgroundColor: '#05070DCC',
    bottom: 10,
    left: 10,
    padding: 9,
    position: 'absolute',
    right: 10,
  },
  sensorValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  warning: {
    color: colors.warning,
  },
});
