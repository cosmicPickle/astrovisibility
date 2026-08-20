import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import {
  createWindowHorizontalProjector,
  equatorialJ2000ToHorizontal,
} from '../astronomy/horizontalCoordinates';
import {
  calculateObstructionAwareTrajectory,
  createVisibilityCalculationCacheKey,
  selectedTrajectoryCache,
  VisibilityCalculationCancelledError,
  type ObstructionVisibilityInput,
  type VisibilityCalculationCache,
  type VisibilityCalculationOptions,
} from '../astronomy/obstructionVisibility';
import {
  localCivilDateTimeAtInstant,
  type ObservingWindow,
} from '../astronomy/localCivilTime';
import {
  formatAboveHorizonIntervals,
  formatDuration,
  formatObservingWindowRange,
  formatSceneControlLabel,
} from '../astronomy/observingWindowPresentation';
import { createDateObservingWindow } from '../astronomy/observingWindow';
import {
  createTargetDiurnalOrbit,
  type TargetDiurnalOrbit,
} from '../astronomy/diurnalTrajectory';
import {
  createSelectedTargetTrajectory,
  mergeTrajectoryAssessment,
  type SelectedTargetTrajectory,
  type TrajectoryMarker,
} from '../astronomy/trajectory';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { OpacitySlider } from '../components/ui/OpacitySlider';
import { calculateAngularFieldOfView } from '../equipment/fieldOfView';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActiveMaskRevision } from '../storage/maskRepository';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import type { ProfileRecord } from '../storage/profileRepository';
import { colors, layout } from '../theme/tokens';
import { projectCatalogueAtInstant } from './catalogueProjection';
import type { HorizontalCatalogueTarget } from './catalogueViewport';
import {
  ObservingWindowSheet,
  type ObservingWindowChange,
} from './ObservingWindowSheet';
import { createCelestialEquatorGuide } from './planetariumGuides';
import { SkyCanvas } from './SkyCanvas';

export interface SkyViewData {
  catalogueTargets: CatalogueTarget[];
  equipment: EquipmentRecord[];
  hasMask: boolean;
  mask: ActiveMaskRevision | null;
  panorama: ActivePanorama | null;
  profile: ProfileRecord;
  projectedTargets: HorizontalCatalogueTarget[];
  selectedEquipmentId: string | null;
  timestampUtc: string;
}

export interface SkyViewController {
  load(profileId: string, timestampUtc?: string): Promise<SkyViewData>;
  selectEquipment(profileId: string, equipmentId: string): Promise<void>;
  deletePanoramaAndMask(profileId: string): Promise<void>;
}

export interface SkyViewNavigation {
  editProfile(profileId: string): void;
  goBack(): void;
  openLicences(): void;
  openMaskEditor(profileId: string): void;
  openPanoramaCapture(profileId: string): void;
  openTargetList(profileId: string, window: ObservingWindow): void;
}

export interface SkyRendererProps {
  celestialEquatorDirections: readonly {
    altitudeDegrees: number;
    azimuthDegrees: number;
  }[];
  fieldOfViewEquipment: EquipmentRecord | null;
  diurnalOrbit: TargetDiurnalOrbit | null;
  onInspectTrajectoryMarker: (marker: TrajectoryMarker) => void;
  onSelectTarget: (target: HorizontalCatalogueTarget) => void;
  selectedDirection: {
    altitudeDegrees: number;
    azimuthDegrees: number;
  } | null;
  selectedTargetId: string | null;
  targets: readonly HorizontalCatalogueTarget[];
  trajectory: SelectedTargetTrajectory | null;
  panoramaOverlay: {
    tiles: ActivePanorama['tiles'];
    opacityPercent: number;
    visible: boolean;
  } | null;
  maskOverlay: {
    mask: ActiveMaskRevision;
    opacityPercent: number;
    visible: boolean;
  } | null;
  observerLatitudeDegrees: number;
}

export const skyViewController: SkyViewController = {
  async load(profileId, requestedTimestampUtc) {
    const nowTimestampUtc = requestedTimestampUtc ?? new Date().toISOString();
    const storage = await bootstrapStorage();
    const [profile, equipment, selectedEquipment, catalogue, mask, panorama] =
      await Promise.all([
        storage.profiles.getById(profileId),
        storage.equipment.list(),
        storage.equipment.getSelectedForProfile(profileId),
        storage.catalogue.listAll(),
        storage.masks.getActiveForProfile(profileId),
        storage.panoramas.getActiveForProfile(profileId),
      ]);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    const observer = observerForProfile(profile);
    const timestampUtc = requestedTimestampUtc ?? nowTimestampUtc;
    const projectedTargets = projectCatalogueAtInstant(catalogue, {
      observer,
      timestampUtc,
    });
    return {
      catalogueTargets: catalogue,
      equipment,
      hasMask: Boolean(mask),
      mask,
      panorama,
      profile,
      projectedTargets,
      selectedEquipmentId: selectedEquipment?.id ?? null,
      timestampUtc,
    };
  },
  async selectEquipment(profileId, equipmentId) {
    const storage = await bootstrapStorage();
    await storage.equipment.selectForProfile(profileId, equipmentId);
  },
  async deletePanoramaAndMask(profileId) {
    const storage = await bootstrapStorage();
    await storage.masks.deleteActivePanoramaAndMasks(
      profileId,
      new Date().toISOString(),
    );
  },
};

const aliasesFor = (target: CatalogueTarget) =>
  [
    ...target.memberships.messier.map((number) => `M ${number}`),
    ...(target.memberships.caldwell === undefined
      ? []
      : [`C ${target.memberships.caldwell}`]),
    ...target.memberships.ngc,
    ...target.memberships.ic,
  ]
    .filter((name) => name !== target.preferredName)
    .slice(0, 3)
    .join(' · ') || target.id;

const observerForProfile = (profile: ProfileRecord) => ({
  latitudeDegreesNorth: profile.latitudeDegreesNorth,
  longitudeDegreesEast: profile.longitudeDegreesEast,
  elevationMetersAboveMeanSeaLevel: profile.elevationMetersAboveMeanSeaLevel,
});

const createDefaultObservingWindow = (data: SkyViewData) => {
  return createDateObservingWindow({
    civilDate: localCivilDateTimeAtInstant(
      data.timestampUtc,
      data.profile.timeZoneId,
    ),
    timeZoneId: data.profile.timeZoneId,
  });
};

export const SkyViewScreen = ({
  calculateVisibility = calculateObstructionAwareTrajectory,
  controller = skyViewController,
  initialObservingWindow,
  initialSelectedTargetId,
  navigation,
  profileId,
  renderSky: SkyRenderer = SkyCanvas,
  visibilityCache = selectedTrajectoryCache,
}: {
  calculateVisibility?: (
    input: ObstructionVisibilityInput,
    options?: VisibilityCalculationOptions,
  ) => Promise<SelectedTargetTrajectory>;
  controller?: SkyViewController;
  initialObservingWindow?: ObservingWindow;
  initialSelectedTargetId?: string;
  navigation: SkyViewNavigation;
  profileId: string;
  renderSky?: (props: SkyRendererProps) => React.ReactNode;
  visibilityCache?: Pick<
    VisibilityCalculationCache,
    'get' | 'set' | 'invalidateProfile'
  >;
}) => {
  const [data, setData] = useState<SkyViewData | null>(null);
  const [observingWindow, setObservingWindow] =
    useState<ObservingWindow | null>(null);
  const [sceneTimestampUtc, setSceneTimestampUtc] = useState<string | null>(
    null,
  );
  const [error, setError] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<CatalogueTarget | null>(
    null,
  );
  const [inspectedMarker, setInspectedMarker] =
    useState<TrajectoryMarker | null>(null);
  const [openSheet, setOpenSheet] = useState<
    'equipment' | 'info' | 'mask' | 'menu' | 'panorama' | 'time' | null
  >(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [panoramaVisible, setPanoramaVisible] = useState(true);
  const [panoramaOpacityPercent, setPanoramaOpacityPercent] = useState(55);
  const [maskVisible, setMaskVisible] = useState(true);
  const [maskOpacityPercent, setMaskOpacityPercent] = useState(60);
  const [trajectory, setTrajectory] = useState<SelectedTargetTrajectory | null>(
    null,
  );
  const [trajectoryStatus, setTrajectoryStatus] = useState<
    'idle' | 'calculating' | 'ready' | 'error'
  >('idle');
  const [calculationAttempt, setCalculationAttempt] = useState(0);

  const load = useCallback(
    async (timestampUtc?: string) => {
      setError(false);
      try {
        const loadedData = await controller.load(profileId, timestampUtc);
        setData(loadedData);
        setObservingWindow(createDefaultObservingWindow(loadedData));
        setSceneTimestampUtc(loadedData.timestampUtc);
      } catch {
        setData(null);
        setObservingWindow(null);
        setSceneTimestampUtc(null);
        setError(true);
      }
    },
    [controller, profileId],
  );

  useEffect(() => {
    let active = true;
    void controller
      .load(profileId, initialObservingWindow?.startTimestampUtc)
      .then(
        (loadedData) => {
          if (!active) return;
          setError(false);
          setData(loadedData);
          setSceneTimestampUtc(loadedData.timestampUtc);
          setObservingWindow(
            initialObservingWindow ?? createDefaultObservingWindow(loadedData),
          );
          setSelectedTarget(
            initialSelectedTargetId
              ? (loadedData.catalogueTargets.find(
                  ({ id }) => id === initialSelectedTargetId,
                ) ?? null)
              : null,
          );
        },
        () => {
          if (!active) return;
          setData(null);
          setObservingWindow(null);
          setSceneTimestampUtc(null);
          setError(true);
        },
      );
    return () => {
      active = false;
    };
  }, [controller, initialObservingWindow, initialSelectedTargetId, profileId]);

  const selectedEquipment = useMemo(
    () =>
      data?.equipment.find((item) => item.id === data.selectedEquipmentId) ??
      null,
    [data],
  );
  const projectedTargets = useMemo(
    () =>
      data && sceneTimestampUtc
        ? projectCatalogueAtInstant(data.catalogueTargets, {
            observer: observerForProfile(data.profile),
            timestampUtc: sceneTimestampUtc,
          })
        : [],
    [data, sceneTimestampUtc],
  );
  const celestialEquatorDirections = useMemo(
    () =>
      data && sceneTimestampUtc
        ? createCelestialEquatorGuide({
            observer: observerForProfile(data.profile),
            timestampUtc: sceneTimestampUtc,
          })
        : [],
    [data, sceneTimestampUtc],
  );
  const selectedDirection = useMemo(() => {
    if (!data || !sceneTimestampUtc || !selectedTarget) return null;
    const horizontal = equatorialJ2000ToHorizontal({
      rightAscensionJ2000Hours: selectedTarget.rightAscensionJ2000Hours,
      declinationJ2000Degrees: selectedTarget.declinationJ2000Degrees,
      observer: observerForProfile(data.profile),
      timestampUtc: sceneTimestampUtc,
    });
    return {
      altitudeDegrees: horizontal.refractedAltitudeDegrees,
      azimuthDegrees: horizontal.azimuthDegreesClockwiseFromNorth,
    };
  }, [data, sceneTimestampUtc, selectedTarget]);
  const diurnalOrbit = useMemo(
    () =>
      data && observingWindow && selectedTarget
        ? createTargetDiurnalOrbit({
            anchorTimestampUtc: observingWindow.startTimestampUtc,
            observer: observerForProfile(data.profile),
            target: selectedTarget,
          })
        : null,
    [data, observingWindow, selectedTarget],
  );
  useEffect(() => {
    if (!data || !observingWindow || !selectedTarget) {
      return;
    }
    const input: ObstructionVisibilityInput = {
      profileId: data.profile.id,
      target: {
        id: selectedTarget.id,
        rightAscensionJ2000Hours: selectedTarget.rightAscensionJ2000Hours,
        declinationJ2000Degrees: selectedTarget.declinationJ2000Degrees,
      },
      observer: observerForProfile(data.profile),
      timeZoneId: data.profile.timeZoneId,
      window: observingWindow,
      panoramaRevisionId: data.panorama?.id ?? null,
      maskRevision: data.mask
        ? {
            id: data.mask.id,
            panoramaRevisionId: data.mask.panoramaRevisionId,
            mask: data.mask,
          }
        : null,
    };
    const cacheKey = createVisibilityCalculationCacheKey(input);
    const baseTrajectory = createSelectedTargetTrajectory({
      target: input.target,
      observer: input.observer,
      projectAt: createWindowHorizontalProjector({
        target: input.target,
        observer: input.observer,
        window: input.window,
      }),
      timeZoneId: input.timeZoneId,
      window: input.window,
    });
    const abortController = new AbortController();
    let active = true;
    const calculate = async () => {
      await Promise.resolve();
      if (!active || abortController.signal.aborted) return;
      setTrajectory(baseTrajectory);
      setTrajectoryStatus('calculating');
      const cached = visibilityCache.get(cacheKey);
      if (cached) {
        setTrajectory(mergeTrajectoryAssessment(baseTrajectory, cached));
        setTrajectoryStatus('ready');
        return;
      }
      try {
        const result = await calculateVisibility(input, {
          signal: abortController.signal,
        });
        if (!active || abortController.signal.aborted) return;
        visibilityCache.set(cacheKey, result);
        setTrajectory(mergeTrajectoryAssessment(baseTrajectory, result));
        setTrajectoryStatus('ready');
      } catch (calculationError: unknown) {
        if (
          !active ||
          abortController.signal.aborted ||
          calculationError instanceof VisibilityCalculationCancelledError
        ) {
          return;
        }
        setTrajectoryStatus('error');
      }
    };
    void calculate();
    return () => {
      active = false;
      abortController.abort();
    };
  }, [
    calculateVisibility,
    calculationAttempt,
    data,
    observingWindow,
    selectedTarget,
    visibilityCache,
  ]);
  const aboveHorizonIntervals = useMemo(
    () =>
      data && trajectory
        ? formatAboveHorizonIntervals(
            trajectory.aboveHorizonIntervals,
            data.profile.timeZoneId,
          )
        : [],
    [data, trajectory],
  );
  const visibleIntervals = useMemo(
    () =>
      data && trajectory
        ? formatAboveHorizonIntervals(
            trajectory.visibilityIntervals,
            data.profile.timeZoneId,
          )
        : [],
    [data, trajectory],
  );
  const selectedFieldOfView = useMemo(
    () =>
      selectedEquipment ? calculateAngularFieldOfView(selectedEquipment) : null,
    [selectedEquipment],
  );

  const selectEquipment = async (equipmentId: string) => {
    if (!data) return;
    setMutationError(null);
    try {
      await controller.selectEquipment(data.profile.id, equipmentId);
      setData({ ...data, selectedEquipmentId: equipmentId });
      setOpenSheet(null);
    } catch {
      setMutationError('The imaging setup could not be changed. Try again.');
    }
  };

  const applyObservingTime = ({
    sceneTimestampUtc: nextSceneTimestampUtc,
    window,
  }: ObservingWindowChange) => {
    const windowChanged =
      window.startTimestampUtc !== observingWindow?.startTimestampUtc ||
      window.endTimestampUtc !== observingWindow?.endTimestampUtc;
    setSceneTimestampUtc(nextSceneTimestampUtc);
    setObservingWindow(window);
    setInspectedMarker(null);
    if (windowChanged && selectedTarget) {
      setTrajectory(null);
      setTrajectoryStatus('calculating');
    }
  };

  const confirmDeletePanoramaAndMask = (recreate: boolean) => {
    if (!data) return;
    Alert.alert(
      recreate ? 'Recreate panorama and mask?' : 'Delete panorama and mask?',
      'This permanently removes the active panorama and every mask revision aligned to it.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          style: 'destructive',
          text: recreate ? 'Delete and recapture' : 'Delete pair',
          onPress: () => {
            setMutationError(null);
            void controller.deletePanoramaAndMask(data.profile.id).then(
              () => {
                visibilityCache.invalidateProfile(data.profile.id);
                setOpenSheet(null);
                if (recreate) {
                  navigation.openPanoramaCapture(data.profile.id);
                } else {
                  void load(data.timestampUtc);
                }
              },
              () => {
                setMutationError(
                  'The panorama and mask could not be deleted. Try again.',
                );
              },
            );
          },
        },
      ],
    );
  };

  if (!data || !observingWindow || !sceneTimestampUtc) {
    return (
      <SafeAreaView style={styles.centered}>
        {error ? (
          <>
            <AppText tone="title">Sky View unavailable</AppText>
            <AppText tone="muted">
              The profile or offline catalogue could not be read from this
              device.
            </AppText>
            <ActionButton label="Try again" onPress={() => void load()} />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <AppText tone="muted">Positioning the offline sky…</AppText>
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to dashboard"
          accessibilityRole="button"
          onPress={navigation.goBack}
          style={styles.iconButton}
        >
          <AppText style={styles.iconText}>‹</AppText>
        </Pressable>
        <View style={styles.profileHeading}>
          <AppText numberOfLines={1} style={styles.profileName}>
            {data.profile.name}
          </AppText>
          <AppText numberOfLines={1} tone="muted">
            {projectedTargets
              .filter(({ altitudeDegrees }) => altitudeDegrees >= 0)
              .length.toLocaleString()}{' '}
            above horizon
          </AppText>
        </View>
        <Pressable
          accessibilityLabel="Sky time"
          accessibilityRole="button"
          onPress={() => setOpenSheet('time')}
          style={styles.timeButton}
        >
          <AppText style={styles.timeText}>
            {formatSceneControlLabel(
              sceneTimestampUtc,
              data.profile.timeZoneId,
            )}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityLabel="Profile menu"
          accessibilityRole="button"
          onPress={() => setOpenSheet('menu')}
          style={styles.iconButton}
        >
          <AppText style={styles.moreText}>•••</AppText>
        </Pressable>
      </View>

      <View style={styles.skyArea}>
        <SkyRenderer
          celestialEquatorDirections={celestialEquatorDirections}
          diurnalOrbit={diurnalOrbit}
          fieldOfViewEquipment={selectedEquipment}
          onInspectTrajectoryMarker={setInspectedMarker}
          onSelectTarget={(target) => {
            setSelectedTarget(target.target);
            setInspectedMarker(null);
            setTrajectory(null);
            setTrajectoryStatus('calculating');
          }}
          selectedDirection={selectedDirection}
          selectedTargetId={selectedTarget?.id ?? null}
          targets={projectedTargets}
          trajectory={trajectory}
          panoramaOverlay={
            data.panorama
              ? {
                  tiles: data.panorama.tiles,
                  opacityPercent: panoramaOpacityPercent,
                  visible: panoramaVisible,
                }
              : null
          }
          maskOverlay={
            data.mask
              ? {
                  mask: data.mask,
                  opacityPercent: maskOpacityPercent,
                  visible: maskVisible,
                }
              : null
          }
          observerLatitudeDegrees={data.profile.latitudeDegreesNorth}
        />
        {!data.hasMask ? (
          <View style={styles.noMaskCallout}>
            <AppText style={styles.calloutTitle}>
              Local visibility not assessed
            </AppText>
            <AppText style={styles.calloutBody}>
              Sky positions are available; obstruction results are not.
            </AppText>
          </View>
        ) : null}
        <View style={styles.equipmentControl}>
          <ActionButton
            label={selectedEquipment?.name ?? 'No imaging setup'}
            onPress={() => setOpenSheet('equipment')}
            variant="secondary"
          />
        </View>
        {data.panorama ? (
          <View style={styles.panoramaControl}>
            <ActionButton
              label={`Panorama ${panoramaOpacityPercent}%`}
              onPress={() => setOpenSheet('panorama')}
              variant="secondary"
            />
          </View>
        ) : null}
        {data.mask ? (
          <View style={styles.maskControl}>
            <ActionButton
              label={`Mask ${maskOpacityPercent}%`}
              onPress={() => setOpenSheet('mask')}
              variant="secondary"
            />
          </View>
        ) : null}
        <View style={styles.targetListControl}>
          <ActionButton
            label="View All Targets"
            onPress={() =>
              navigation.openTargetList(data.profile.id, observingWindow)
            }
          />
        </View>
        {selectedTarget ? (
          <View style={styles.targetSummary}>
            <View style={styles.targetSummaryHeading}>
              <View style={styles.targetSummaryCopy}>
                <AppText style={styles.targetName}>
                  {selectedTarget.preferredName}
                </AppText>
                <AppText tone="muted">{aliasesFor(selectedTarget)}</AppText>
              </View>
              <ActionButton
                accessibilityLabel="Close selected target"
                label="Close"
                onPress={() => {
                  setSelectedTarget(null);
                  setInspectedMarker(null);
                  setTrajectory(null);
                  setTrajectoryStatus('idle');
                }}
                variant="text"
              />
            </View>
            <View style={styles.assessmentSummary}>
              {trajectoryStatus === 'calculating' ? (
                <View style={styles.calculatingRow}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <AppText accessibilityLiveRegion="polite" tone="muted">
                    {data.mask
                      ? 'Checking local obstructions…'
                      : 'Positioning trajectory…'}
                  </AppText>
                </View>
              ) : trajectoryStatus === 'error' ? (
                <>
                  <AppText
                    accessibilityLiveRegion="polite"
                    style={styles.errorText}
                  >
                    Visibility could not be calculated.
                  </AppText>
                  <ActionButton
                    label="Try visibility again"
                    onPress={() =>
                      setCalculationAttempt((current) => current + 1)
                    }
                    variant="secondary"
                  />
                </>
              ) : data.mask && trajectory ? (
                <>
                  <AppText style={styles.visibleText}>
                    {trajectory.totalVisibleMilliseconds > 0
                      ? `${formatDuration(trajectory.totalVisibleMilliseconds)} visible through local obstructions`
                      : 'No visible time through local obstructions'}
                  </AppText>
                  <AppText tone="muted">
                    {visibleIntervals.length > 0
                      ? visibleIntervals.join(' · ')
                      : 'No visible intervals'}
                  </AppText>
                  {trajectory.transitions.length > 0 ? (
                    <AppText style={styles.transitionText}>
                      {trajectory.transitions
                        .map(({ displayLabel }) => displayLabel)
                        .join(' · ')}
                    </AppText>
                  ) : null}
                  <AppText tone="muted">
                    {formatDuration(trajectory.totalAboveHorizonMilliseconds)}{' '}
                    above horizon
                    {selectedEquipment ? ` · ${selectedEquipment.name}` : ''}
                  </AppText>
                </>
              ) : (
                <>
                  <AppText style={styles.unassessedText}>
                    Above horizon; obstructions not assessed
                  </AppText>
                  <AppText tone="muted">
                    {trajectory?.totalAboveHorizonMilliseconds
                      ? `${formatDuration(trajectory.totalAboveHorizonMilliseconds)} above horizon`
                      : 'Below horizon throughout this window'}
                    {selectedEquipment ? ` · ${selectedEquipment.name}` : ''}
                  </AppText>
                  {aboveHorizonIntervals.length > 0 ? (
                    <AppText tone="muted">
                      {aboveHorizonIntervals.join(' · ')}
                    </AppText>
                  ) : null}
                </>
              )}
              {inspectedMarker ? (
                <AppText
                  accessibilityLiveRegion="polite"
                  style={styles.markerText}
                >
                  {inspectedMarker.localTimeLabel} ·{' '}
                  {inspectedMarker.refractedAltitudeDegrees.toFixed(1)}° alt ·{' '}
                  {inspectedMarker.azimuthDegreesClockwiseFromNorth.toFixed(1)}°
                  az ·{' '}
                  {inspectedMarker.assessment === 'visible'
                    ? 'visible'
                    : inspectedMarker.assessment === 'blocked'
                      ? 'blocked'
                      : inspectedMarker.assessment === 'unassessed'
                        ? 'obstructions not assessed'
                        : 'below horizon'}
                </AppText>
              ) : null}
            </View>
            <ActionButton
              label="More Info"
              onPress={() => setOpenSheet('info')}
              variant="secondary"
            />
          </View>
        ) : null}
      </View>

      {mutationError ? (
        <AppText accessibilityLiveRegion="polite" style={styles.errorText}>
          {mutationError}
        </AppText>
      ) : null}

      <ModalSheet
        closeAccessibilityLabel="Close equipment sheet"
        onClose={() => setOpenSheet(null)}
        title="Imaging setup"
        visible={openSheet === 'equipment'}
      >
        {data.equipment.length === 0 ? (
          <AppText tone="muted">
            No saved setup. Sky browsing remains available without field-of-view
            constraints.
          </AppText>
        ) : (
          data.equipment.map((item) => (
            <ActionButton
              accessibilityLabel={`Use ${item.name} imaging setup`}
              key={item.id}
              label={`${item.id === data.selectedEquipmentId ? 'Selected · ' : ''}${item.name}`}
              onPress={() => void selectEquipment(item.id)}
              variant={
                item.id === data.selectedEquipmentId ? 'primary' : 'secondary'
              }
            />
          ))
        )}
      </ModalSheet>

      <ModalSheet
        closeAccessibilityLabel="Close mask overlay controls"
        onClose={() => setOpenSheet(null)}
        title="Visibility mask overlay"
        visible={openSheet === 'mask'}
      >
        <ActionButton
          label={maskVisible ? 'Hide mask' : 'Show mask'}
          onPress={() => setMaskVisible((current) => !current)}
          variant="secondary"
        />
        <OpacitySlider
          label="Mask opacity"
          onChange={setMaskOpacityPercent}
          value={maskOpacityPercent}
        />
        <AppText tone="muted">
          Blue solid areas are marked visible. Neutral dashed corrections are
          blocked. Unmarked and uncaptured directions remain blocked.
        </AppText>
      </ModalSheet>

      <ModalSheet
        closeAccessibilityLabel="Close target information"
        onClose={() => setOpenSheet(null)}
        title={selectedTarget?.preferredName ?? 'Target information'}
        visible={openSheet === 'info'}
      >
        {selectedTarget ? (
          <>
            <Detail
              label="Catalogue names"
              value={aliasesFor(selectedTarget)}
            />
            <Detail label="Type" value={selectedTarget.objectType} />
            <Detail
              label="Magnitude"
              value={selectedTarget.magnitude?.toFixed(1) ?? 'Unknown'}
            />
            <Detail
              label="Angular size"
              value={
                selectedTarget.majorAxisArcminutes
                  ? `${selectedTarget.majorAxisArcminutes}′ × ${selectedTarget.minorAxisArcminutes ?? selectedTarget.majorAxisArcminutes}′`
                  : 'Unknown'
              }
            />
            <Detail
              label="Right ascension (J2000)"
              value={`${selectedTarget.rightAscensionJ2000Hours.toFixed(3)} h`}
            />
            <Detail
              label="Declination (J2000)"
              value={`${selectedTarget.declinationJ2000Degrees.toFixed(3)}°`}
            />
            <Detail
              label="Sky position at window start"
              value={
                selectedDirection
                  ? `${selectedDirection.azimuthDegrees.toFixed(1)}° az · ${selectedDirection.altitudeDegrees.toFixed(1)}° alt`
                  : 'Below horizon'
              }
            />
            <Detail
              label="Observing window"
              value={formatObservingWindowRange(
                observingWindow,
                data.profile.timeZoneId,
              )}
            />
            <Detail
              label="Astronomical time above horizon"
              value={
                trajectoryStatus === 'calculating'
                  ? 'Calculating'
                  : trajectory
                    ? data.mask
                      ? formatDuration(trajectory.totalAboveHorizonMilliseconds)
                      : `${formatDuration(trajectory.totalAboveHorizonMilliseconds)} · local obstructions not assessed`
                    : 'Not calculated'
              }
            />
            <Detail
              label="Above-horizon intervals"
              value={aboveHorizonIntervals.join(' · ') || 'None'}
            />
            <Detail
              label="Local obstruction visibility"
              value={
                !data.mask
                  ? 'Not assessed; no completed mask'
                  : trajectory
                    ? `${formatDuration(trajectory.totalVisibleMilliseconds)} · ${visibleIntervals.join(' · ') || 'no visible intervals'}`
                    : trajectoryStatus === 'error'
                      ? 'Calculation failed'
                      : 'Calculating'
              }
            />
            <Detail
              label="Selected imaging setup"
              value={
                selectedEquipment && selectedFieldOfView
                  ? `${selectedEquipment.name} · ${selectedFieldOfView.horizontalFovDegrees.toFixed(2)}° × ${selectedFieldOfView.verticalFovDegrees.toFixed(2)}° · ${selectedEquipment.frameRotationDegrees}° rotation`
                  : 'None; Sky View remains available'
              }
            />
            <AppText style={styles.fovNote} tone="muted">
              The frame is visual only. V1 obstruction calculations use the
              target centre.
            </AppText>
          </>
        ) : null}
      </ModalSheet>

      <ModalSheet
        closeAccessibilityLabel="Close panorama overlay controls"
        onClose={() => setOpenSheet(null)}
        title="Panorama overlay"
        visible={openSheet === 'panorama'}
      >
        <ActionButton
          label={panoramaVisible ? 'Hide panorama' : 'Show panorama'}
          onPress={() => setPanoramaVisible((current) => !current)}
          variant="secondary"
        />
        <OpacitySlider
          label="Panorama opacity"
          onChange={setPanoramaOpacityPercent}
          value={panoramaOpacityPercent}
        />
        <AppText tone="muted">
          The panorama is visual only. Its opacity never changes astronomy or
          obstruction calculations.
        </AppText>
      </ModalSheet>

      <ObservingWindowSheet
        observer={observerForProfile(data.profile)}
        onChange={applyObservingTime}
        onClose={() => setOpenSheet(null)}
        sceneTimestampUtc={sceneTimestampUtc}
        timeZoneId={data.profile.timeZoneId}
        visible={openSheet === 'time'}
        window={observingWindow}
      />

      <ModalSheet
        closeAccessibilityLabel="Close profile menu"
        onClose={() => setOpenSheet(null)}
        title="Profile menu"
        visible={openSheet === 'menu'}
      >
        <View style={styles.menuStatus}>
          <AppText tone="label">Panorama and mask</AppText>
          <AppText tone="muted">
            {data.hasMask
              ? 'Panorama and local obstruction mask saved'
              : data.panorama
                ? 'Panorama saved · visibility mask not drawn'
                : 'Not created'}
          </AppText>
        </View>
        {!data.panorama ? (
          <ActionButton
            label="Capture panorama"
            onPress={() => {
              setOpenSheet(null);
              navigation.openPanoramaCapture(data.profile.id);
            }}
            variant="secondary"
          />
        ) : null}
        {data.panorama ? (
          <ActionButton
            label={data.mask ? 'Edit visibility mask' : 'Draw visibility mask'}
            onPress={() => {
              setOpenSheet(null);
              navigation.openMaskEditor(data.profile.id);
            }}
            variant="secondary"
          />
        ) : null}
        {data.panorama ? (
          <>
            <ActionButton
              label="Recreate panorama and mask"
              onPress={() => confirmDeletePanoramaAndMask(true)}
              variant="danger"
            />
            <ActionButton
              label="Delete panorama and mask"
              onPress={() => confirmDeletePanoramaAndMask(false)}
              variant="danger"
            />
          </>
        ) : null}
        <ActionButton
          label="Edit profile"
          onPress={() => {
            setOpenSheet(null);
            navigation.editProfile(data.profile.id);
          }}
          variant="secondary"
        />
        <ActionButton
          label="About and licences"
          onPress={() => {
            setOpenSheet(null);
            navigation.openLicences();
          }}
          variant="secondary"
        />
      </ModalSheet>
    </SafeAreaView>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detail}>
    <AppText tone="label">{label}</AppText>
    <AppText>{value || 'Not listed'}</AppText>
  </View>
);

const styles = StyleSheet.create({
  assessmentSummary: {
    gap: 3,
  },
  calculatingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  calloutBody: {
    color: colors.mutedText,
    fontSize: 12,
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: layout.sectionGap,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  detail: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: layout.cardRadius,
    gap: 4,
    padding: 12,
  },
  equipmentControl: {
    left: 12,
    maxWidth: '58%',
    position: 'absolute',
    top: 72,
  },
  panoramaControl: {
    left: 12,
    maxWidth: '58%',
    position: 'absolute',
    top: 126,
  },
  maskControl: {
    left: 12,
    maxWidth: '58%',
    position: 'absolute',
    top: 180,
  },
  fovNote: {
    fontSize: 12,
  },
  errorText: {
    backgroundColor: colors.surface,
    color: colors.danger,
    padding: 10,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomColor: colors.outline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    minHeight: 58,
    paddingHorizontal: 6,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 22,
    height: layout.minimumTouchTarget,
    justifyContent: 'center',
    width: layout.minimumTouchTarget,
  },
  iconText: {
    fontSize: 34,
    lineHeight: 36,
  },
  menuStatus: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: layout.cardRadius,
    gap: 4,
    padding: 12,
  },
  markerText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  moreText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  noMaskCallout: {
    backgroundColor: 'rgba(17, 24, 39, 0.94)',
    borderColor: colors.warning,
    borderRadius: layout.cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: 'absolute',
    right: 12,
    top: 10,
  },
  profileHeading: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  skyArea: {
    flex: 1,
  },
  targetListControl: {
    bottom: 12,
    position: 'absolute',
    right: 12,
  },
  targetName: {
    fontSize: 18,
    fontWeight: '800',
  },
  targetSummary: {
    backgroundColor: 'rgba(17, 24, 39, 0.97)',
    borderColor: colors.spaceViolet,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 70,
    gap: 8,
    left: 12,
    padding: 14,
    position: 'absolute',
    right: 12,
  },
  targetSummaryCopy: {
    flex: 1,
  },
  targetSummaryHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  timeButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: layout.controlRadius,
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  transitionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  unassessedText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
  },
  visibleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
