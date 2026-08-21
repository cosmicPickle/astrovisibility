import { CameraView } from 'expo-camera';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { observerForProfile } from '../profiles/profileObserver';
import { PlanetariumScene } from '../sky/PlanetariumScene';
import { createCelestialEquatorGuide } from '../sky/planetariumGuides';
import { createPlanetariumCamera } from '../sky/planetariumProjection';
import type { CanvasSizePixels } from '../sky/projection';
import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import type { ProfileRecord } from '../storage/profileRepository';
import { colors } from '../theme/tokens';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import type { CapturedProofTile } from './captureSession';
import {
  createPoseDrivenPlanetariumCamera,
  poseCaptureAltitudeStatus,
  type CaptureCameraFieldOfView,
  type DevicePoseSample,
} from './devicePose';
import { selectPanoramaPictureSize } from './panoramaPictureSize';
import type { CapturePoseReadiness } from './poseReadiness';

const CAPTURE_ATLAS_FIELD_OF_VIEW_DEGREES = 100;

const captureAltitudeMessage = (
  status: Exclude<ReturnType<typeof poseCaptureAltitudeStatus>, 'allowed'>,
) => {
  return status === 'below-horizon'
    ? 'Aim the center of the camera at or above the horizon.'
    : '';
};

const fieldOfViewLabel = (fieldOfView: CaptureCameraFieldOfView) =>
  `${Math.round(fieldOfView.horizontalDegrees)}° × ${Math.round(fieldOfView.verticalDegrees)}° camera FOV · ${fieldOfView.approximate ? 'fallback estimate' : 'metadata-derived estimate'}`;

const poseReadinessMessage = (readiness: CapturePoseReadiness) => {
  if (readiness === 'stabilizing') return 'Hold the phone steady…';
  if (readiness === 'stale')
    return 'Direction update paused. Hold the phone steady.';
  if (readiness === 'unreliable') {
    return 'Direction is unreliable. Move away from metal and sweep the phone in a figure eight.';
  }
  if (readiness === 'acquiring') return 'Acquiring phone direction…';
  return null;
};

const toPanoramaTile = (tile: CapturedProofTile): ActivePanoramaTile => ({
  centerAltitudeDegrees: tile.reviewedPlacement.centerAltitudeDegrees,
  centerAzimuthDegrees: tile.reviewedPlacement.centerAzimuthDegrees,
  heightPixels: tile.heightPixels,
  horizontalFieldOfViewDegrees:
    tile.reviewedPlacement.horizontalFieldOfViewDegrees,
  id: tile.id,
  coveragePolygon: tile.coveragePolygon,
  rollDegrees: tile.reviewedPlacement.rollDegrees,
  uri: tile.uri,
  verticalFieldOfViewDegrees: tile.reviewedPlacement.verticalFieldOfViewDegrees,
  widthPixels: tile.widthPixels,
});

const guideSize = (
  canvas: CanvasSizePixels,
  fieldOfView: CaptureCameraFieldOfView,
) => {
  const scale =
    Math.min(canvas.widthPixels, canvas.heightPixels) /
    2 /
    Math.tan((CAPTURE_ATLAS_FIELD_OF_VIEW_DEGREES * Math.PI) / 720);
  return {
    height: 2 * scale * Math.tan((fieldOfView.verticalDegrees * Math.PI) / 720),
    width:
      2 * scale * Math.tan((fieldOfView.horizontalDegrees * Math.PI) / 720),
  };
};

export function PoseDrivenCaptureView({
  busy,
  cameraGranted,
  cameraRef,
  fieldOfView,
  onCapture,
  onOpenSettings,
  onFinish,
  pose,
  poseError,
  poseReadiness,
  profile,
  tiles,
}: {
  busy: boolean;
  cameraGranted: boolean;
  cameraRef: RefObject<CameraView | null>;
  fieldOfView: CaptureCameraFieldOfView;
  onCapture(): void;
  onOpenSettings(): void;
  onFinish(): void;
  pose: DevicePoseSample | null;
  poseError: string | null;
  poseReadiness: CapturePoseReadiness;
  profile: ProfileRecord;
  tiles: readonly CapturedProofTile[];
}) {
  const [canvas, setCanvas] = useState<CanvasSizePixels>({
    heightPixels: 1,
    widthPixels: 1,
  });
  const [pictureSize, setPictureSize] = useState<string | null>(null);
  const camera = useSharedValue(
    createPlanetariumCamera({
      centerAltitudeDegrees: 45,
      centerAzimuthDegrees: 0,
      fieldOfViewDegrees: CAPTURE_ATLAS_FIELD_OF_VIEW_DEGREES,
    }),
  );
  useEffect(() => {
    if (pose) {
      camera.value = createPoseDrivenPlanetariumCamera(
        pose,
        CAPTURE_ATLAS_FIELD_OF_VIEW_DEGREES,
      );
    }
  }, [camera, pose]);

  const panoramaTiles = useMemo(() => tiles.map(toPanoramaTile), [tiles]);
  const celestialEquatorDirections = useMemo(
    () =>
      createCelestialEquatorGuide({
        observer: observerForProfile(profile),
        timestampUtc: new Date().toISOString(),
      }),
    [profile],
  );
  const altitudeStatus = pose ? poseCaptureAltitudeStatus(pose) : null;
  const captureAllowed =
    !busy &&
    cameraGranted &&
    poseReadiness === 'ready' &&
    altitudeStatus === 'allowed';
  const readinessMessage = poseReadinessMessage(poseReadiness);
  const frameSize = guideSize(canvas, fieldOfView);
  const handleAtlasLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (height > 0 && width > 0) {
      setCanvas({ heightPixels: height, widthPixels: width });
    }
  };
  const selectPictureSize = async () => {
    try {
      const availableSizes =
        await cameraRef.current?.getAvailablePictureSizesAsync();
      setPictureSize(selectPanoramaPictureSize(availableSizes ?? []));
    } catch {
      // Capture remains usable with Expo's platform-selected 4:3 size.
      setPictureSize(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View accessibilityLabel="Live camera preview" style={styles.previewHalf}>
        {cameraGranted ? (
          <CameraView
            accessibilityLabel="Rear camera preview at 1x"
            facing="back"
            onCameraReady={() => void selectPictureSize()}
            pictureSize={pictureSize ?? undefined}
            ratio="4:3"
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            zoom={0}
          />
        ) : (
          <View style={styles.fallback}>
            <AppText tone="label">Camera access unavailable</AppText>
            <AppText tone="muted">
              Enable camera access in system settings, then return here.
            </AppText>
            <ActionButton
              label="Open settings"
              onPress={onOpenSettings}
              variant="secondary"
            />
          </View>
        )}
        <View pointerEvents="none" style={styles.previewReticle} />
      </View>

      <View
        accessibilityLabel="Phone-directed sky view"
        onLayout={handleAtlasLayout}
        style={styles.atlasHalf}
      >
        <PlanetariumScene
          camera={camera}
          canvas={canvas}
          celestialEquatorDirections={celestialEquatorDirections}
          diurnalOrbit={null}
          equipment={null}
          mask={null}
          maskOpacity={0}
          panoramaOpacity={0.72}
          panoramaTiles={panoramaTiles}
          selectedTargetId={null}
          targets={[]}
          trajectory={null}
        />
        <View
          accessibilityLabel="Current camera footprint"
          pointerEvents="none"
          style={[
            styles.cameraFootprint,
            {
              height: frameSize.height,
              marginLeft: -frameSize.width / 2,
              marginTop: -frameSize.height / 2,
              width: frameSize.width,
            },
            altitudeStatus && altitudeStatus !== 'allowed'
              ? styles.cameraFootprintInvalid
              : null,
          ]}
        />
        <View pointerEvents="none" style={styles.atlasStatus}>
          <AppText style={styles.atlasStatusText}>
            {pose ? `${tiles.length} captured` : 'Acquiring phone direction…'}
          </AppText>
          <AppText style={styles.fieldOfViewText}>
            {fieldOfViewLabel(fieldOfView)}
          </AppText>
          {altitudeStatus && altitudeStatus !== 'allowed' ? (
            <AppText accessibilityRole="alert" style={styles.limitText}>
              {captureAltitudeMessage(altitudeStatus)}
            </AppText>
          ) : null}
          {readinessMessage ? (
            <AppText accessibilityRole="alert" style={styles.limitText}>
              {readinessMessage}
            </AppText>
          ) : null}
          {poseError ? (
            <AppText style={styles.limitText}>{poseError}</AppText>
          ) : null}
        </View>
        <View style={styles.actions}>
          <ActionButton
            disabled={!captureAllowed}
            label="Capture"
            loading={busy}
            onPress={onCapture}
          />
          <ActionButton
            disabled={tiles.length === 0}
            label="Align Tiles"
            onPress={onFinish}
            variant="secondary"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    bottom: 10,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    left: 8,
    position: 'absolute',
    right: 8,
  },
  atlasHalf: {
    backgroundColor: colors.backdrop,
    flex: 56,
    overflow: 'hidden',
  },
  atlasStatus: {
    backgroundColor: 'rgba(5, 7, 13, 0.76)',
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: 'absolute',
    top: 8,
  },
  atlasStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cameraFootprint: {
    alignSelf: 'center',
    backgroundColor: 'rgba(82, 151, 255, 0.14)',
    borderColor: '#5ca0ff',
    borderWidth: 2,
    left: '50%',
    position: 'absolute',
    top: '50%',
  },
  cameraFootprintInvalid: {
    backgroundColor: 'rgba(255, 85, 101, 0.15)',
    borderColor: colors.danger,
  },
  fallback: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 24,
  },
  fieldOfViewText: {
    color: colors.mutedText,
    fontSize: 10,
  },
  limitText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
  },
  previewHalf: {
    backgroundColor: colors.backdrop,
    borderBottomColor: colors.primary,
    borderBottomWidth: 1,
    flex: 44,
    overflow: 'hidden',
  },
  previewReticle: {
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    left: '50%',
    marginLeft: -18,
    marginTop: -18,
    position: 'absolute',
    top: '50%',
    width: 36,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
