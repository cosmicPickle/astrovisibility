import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import {
  createAstronomicalDarknessIntervals,
  intersectTimeIntervals,
} from '../astronomy/astronomicalDarkness';
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
  createCelestialTimeTransform,
  type CelestialTimeTransform,
} from '../astronomy/celestialTimeTransform';
import {
  calculateObstructionAwareTrajectory,
  createVisibilityCalculationCacheKey,
  createVisibilityCalculationContextKey,
  createVisibilityCalculationTargetKey,
  selectedTrajectoryCache,
  VisibilityCalculationCancelledError,
  type ObstructionVisibilityInput,
  type VisibilityCalculationCache,
  type VisibilityCalculationOptions,
} from '../astronomy/obstructionVisibility';
import type { ObservingWindow } from '../astronomy/localCivilTime';
import {
  formatAboveHorizonIntervals,
  formatDuration,
  formatObservingWindowRange,
  formatSceneControlLabel,
} from '../astronomy/observingWindowPresentation';
import {
  createDateObservingWindow,
  getNoonCenteredObservingDate,
} from '../astronomy/observingWindow';
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
import { AngleSlider } from '../components/ui/AngleSlider';
import { AppIcon } from '../components/ui/AppIcon';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { OpacitySlider } from '../components/ui/OpacitySlider';
import { TargetDensitySlider } from '../components/ui/TargetDensitySlider';
import { calculateAngularFieldOfView } from '../equipment/fieldOfView';
import { createVisibilityMaskEvaluator } from '../mask/visibilityMask';
import { observerForProfile } from '../profiles/profileObserver';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActiveMaskRevision } from '../storage/maskRepository';
import type { ActivePanorama } from '../storage/panoramaDraftRepository';
import type { ProfileRecord } from '../storage/profileRepository';
import type { VisibilityCalculationCacheRepository } from '../storage/visibilityCalculationCacheRepository';
import { colors, layout } from '../theme/tokens';
import { evaluateEquipmentSuitability } from '../targets/equipmentSuitability';
import { filterCatalogueForDiscovery } from '../targets/targetDiscoveryFilter';
import { TargetDiscoveryControls } from '../targets/TargetDiscoveryControls';
import { useTargetDiscoveryState } from '../targets/targetDiscoveryState';
import { DEFAULT_MINIMUM_ATLAS_TARGET_COUNT } from '../targets/atlasDensity';
import { useDebouncedValue } from '../targets/useDebouncedValue';
import { projectCatalogueAtInstant } from './catalogueProjection';
import type { HorizontalCatalogueTarget } from './planetariumCatalogue';
import {
  ObservingWindowSheet,
  type ObservingWindowChange,
} from './ObservingWindowSheet';
import {
  MaskAppearanceControls,
  type MaskMode,
} from './MaskAppearanceControls';
import { createCelestialEquatorGuide } from './planetariumGuides';
import { SkyCanvas } from './SkyCanvas';
import {
  createRegisteredCelestialDsoImages,
  registeredCelestialSky,
  type RegisteredCelestialDsoImage,
  type RegisteredCelestialSky,
} from './celestialSkyGeometry';
import dsoImageMetadataJson from './generated/dso-images.json';
import { dsoImageAssets } from './registeredSkyAssets';
import {
  createCelestialCatalogue,
  type CelestialCatalogueTarget,
} from './celestialCatalogue';

export interface SkyViewData {
  catalogueTargets: CatalogueTarget[];
  equipment: EquipmentRecord[];
  hasMask: boolean;
  mask: ActiveMaskRevision | null;
  panorama: ActivePanorama | null;
  profile: ProfileRecord;
  selectedEquipmentId: string | null;
  timestampUtc: string;
  visibilityCache?: VisibilityCalculationCacheRepository;
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
  astronomicalDarknessIntervals?: readonly import('../astronomy/trajectory').VisibilityInterval[];
  celestialEquatorDirections: readonly {
    altitudeDegrees: number;
    azimuthDegrees: number;
  }[];
  densityCandidateCount: number;
  fieldOfViewEquipment: EquipmentRecord | null;
  fieldOfViewRotationDegrees: number;
  focusRequest: {
    direction: { altitudeDegrees: number; azimuthDegrees: number };
    id: number;
  } | null;
  diurnalOrbit: TargetDiurnalOrbit | null;
  onInspectTrajectoryMarker: (marker: TrajectoryMarker) => void;
  onSelectTarget: (target: HorizontalCatalogueTarget) => void;
  selectedTargetId: string | null;
  targets: readonly HorizontalCatalogueTarget[];
  trajectory: SelectedTargetTrajectory | null;
  maskPresentation: {
    color: string;
    mask: ActiveMaskRevision;
    mode: MaskMode;
    opacityPercent: number;
    panorama: ActivePanorama | null;
  } | null;
  minimumTargetCount: number;
  constellationOpacityPercent: number;
  celestialTimeTransform: CelestialTimeTransform;
  sceneTimeMilliseconds: SharedValue<number>;
  registeredCelestialSky: RegisteredCelestialSky;
  registeredCelestialDsoImages: readonly RegisteredCelestialDsoImage[];
  celestialTargets: readonly CelestialCatalogueTarget[];
  controlTimeMilliseconds: number;
}

const dsoImageMetadata = dsoImageMetadataJson as {
  declinationJ2000Degrees: number;
  fieldOfViewDegrees: number;
  rightAscensionJ2000Hours: number;
  targetId: string;
}[];

const registeredCelestialDsoImages = createRegisteredCelestialDsoImages(
  dsoImageMetadata.flatMap((metadata) => {
    const source = dsoImageAssets[metadata.targetId];
    return source === undefined ? [] : [{ ...metadata, source }];
  }),
);

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
    const timestampUtc = requestedTimestampUtc ?? nowTimestampUtc;
    return {
      catalogueTargets: catalogue,
      equipment,
      hasMask: Boolean(mask),
      mask,
      panorama,
      profile,
      selectedEquipmentId: selectedEquipment?.id ?? null,
      timestampUtc,
      visibilityCache: storage.visibilityCache,
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

const createDefaultObservingWindow = (data: SkyViewData) => {
  return createDateObservingWindow({
    civilDate: getNoonCenteredObservingDate(
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
  const [controlTimestampUtc, setControlTimestampUtc] = useState<string | null>(
    null,
  );
  const sceneTimeMilliseconds = useSharedValue(0);
  const lastControlPreviewMilliseconds = useRef(0);
  const [error, setError] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<CatalogueTarget | null>(
    null,
  );
  const [targetFocusRequestId, setTargetFocusRequestId] = useState(0);
  const [inspectedMarker, setInspectedMarker] =
    useState<TrajectoryMarker | null>(null);
  const [openSheet, setOpenSheet] = useState<
    | 'info'
    | 'constellations'
    | 'mask'
    | 'menu'
    | 'optics'
    | 'orientation'
    | 'time'
    | 'viewOptions'
    | null
  >(null);
  const [opticsDropdownOpen, setOpticsDropdownOpen] = useState(false);
  const [fieldOfViewRotationDegrees, setFieldOfViewRotationDegrees] =
    useState(0);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [maskOpacityPercent, setMaskOpacityPercent] = useState(60);
  const [maskMode, setMaskMode] = useState<MaskMode>('panorama');
  const [maskColor, setMaskColor] = useState<string>(colors.blocked);
  const [constellationOpacityPercent, setConstellationOpacityPercent] =
    useState(30);
  const [minimumTargetCount, setMinimumTargetCount] = useState(
    DEFAULT_MINIMUM_ATLAS_TARGET_COUNT,
  );
  const [trajectory, setTrajectory] = useState<SelectedTargetTrajectory | null>(
    null,
  );
  const [trajectoryStatus, setTrajectoryStatus] = useState<
    'idle' | 'calculating' | 'ready' | 'error'
  >('idle');
  const [calculationAttempt, setCalculationAttempt] = useState(0);
  const {
    searchText: targetSearchText,
    selectedCategories,
    setSearchText: setTargetSearchText,
    toggleCategory: toggleTargetCategory,
  } = useTargetDiscoveryState(profileId);
  const debouncedTargetSearchText = useDebouncedValue(targetSearchText, 250);

  const load = useCallback(
    async (timestampUtc?: string) => {
      setError(false);
      try {
        const loadedData = await controller.load(profileId, timestampUtc);
        setData(loadedData);
        setObservingWindow(createDefaultObservingWindow(loadedData));
        setSceneTimestampUtc(loadedData.timestampUtc);
        setControlTimestampUtc(loadedData.timestampUtc);
        sceneTimeMilliseconds.set(Date.parse(loadedData.timestampUtc));
      } catch {
        setData(null);
        setObservingWindow(null);
        setSceneTimestampUtc(null);
        setControlTimestampUtc(null);
        setError(true);
      }
    },
    [controller, profileId, sceneTimeMilliseconds],
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
          setControlTimestampUtc(loadedData.timestampUtc);
          sceneTimeMilliseconds.set(Date.parse(loadedData.timestampUtc));
          setObservingWindow(
            initialObservingWindow ?? createDefaultObservingWindow(loadedData),
          );
          const initialTarget = initialSelectedTargetId
            ? (loadedData.catalogueTargets.find(
                ({ id }) => id === initialSelectedTargetId,
              ) ?? null)
            : null;
          setSelectedTarget(initialTarget);
          if (initialTarget) {
            setTargetFocusRequestId((current) => current + 1);
          }
        },
        () => {
          if (!active) return;
          setData(null);
          setObservingWindow(null);
          setSceneTimestampUtc(null);
          setControlTimestampUtc(null);
          setError(true);
        },
      );
    return () => {
      active = false;
    };
  }, [
    controller,
    initialObservingWindow,
    initialSelectedTargetId,
    profileId,
    sceneTimeMilliseconds,
  ]);

  const selectedEquipment = useMemo(
    () =>
      data?.equipment.find((item) => item.id === data.selectedEquipmentId) ??
      null,
    [data],
  );
  const discoverableCatalogueTargets = useMemo(() => {
    if (!data) return [];
    return filterCatalogueForDiscovery(
      data.catalogueTargets,
      debouncedTargetSearchText,
      selectedCategories,
    ).filter(
      (target) =>
        !selectedEquipment ||
        evaluateEquipmentSuitability(target, selectedEquipment).eligible,
    );
  }, [data, debouncedTargetSearchText, selectedCategories, selectedEquipment]);
  const atlasCatalogueTargets = useMemo(() => {
    if (
      !selectedTarget ||
      discoverableCatalogueTargets.some(({ id }) => id === selectedTarget.id)
    ) {
      return discoverableCatalogueTargets;
    }
    return [...discoverableCatalogueTargets, selectedTarget];
  }, [discoverableCatalogueTargets, selectedTarget]);
  const projectedTargets = useMemo(
    () =>
      data && sceneTimestampUtc
        ? projectCatalogueAtInstant(atlasCatalogueTargets, {
            observer: observerForProfile(data.profile),
            timestampUtc: sceneTimestampUtc,
          })
        : [],
    [atlasCatalogueTargets, data, sceneTimestampUtc],
  );
  const celestialTargets = useMemo(
    () => createCelestialCatalogue(atlasCatalogueTargets),
    [atlasCatalogueTargets],
  );
  const visibleSuitableTargetCount = useMemo(() => {
    if (!data) return 0;
    const discoverableTargetIds = new Set(
      discoverableCatalogueTargets.map(({ id }) => id),
    );
    const maskEvaluator = data.mask
      ? createVisibilityMaskEvaluator(data.mask)
      : null;
    return projectedTargets.filter((target) => {
      if (
        !discoverableTargetIds.has(target.target.id) ||
        target.altitudeDegrees < 0
      ) {
        return false;
      }
      return (
        !maskEvaluator ||
        maskEvaluator.classify({
          altitudeDegrees: target.altitudeDegrees,
          azimuthDegrees: target.azimuthDegrees,
        }) === 'visible'
      );
    }).length;
  }, [data, discoverableCatalogueTargets, projectedTargets]);
  const celestialEquatorDirections = useMemo(
    () =>
      data && controlTimestampUtc
        ? createCelestialEquatorGuide({
            observer: observerForProfile(data.profile),
            timestampUtc: controlTimestampUtc,
          })
        : [],
    [controlTimestampUtc, data],
  );
  const celestialTimeTransform = useMemo(
    () =>
      data && observingWindow
        ? createCelestialTimeTransform({
            observer: observerForProfile(data.profile),
            window: observingWindow,
          })
        : null,
    [data, observingWindow],
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
  const astronomicalDarknessIntervals = useMemo(
    () =>
      data && observingWindow
        ? createAstronomicalDarknessIntervals(
            observerForProfile(data.profile),
            observingWindow,
          )
        : [],
    [data, observingWindow],
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
    const contextKey = createVisibilityCalculationContextKey(input);
    const targetKey = createVisibilityCalculationTargetKey(input.target);
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
      let cached = visibilityCache.get(cacheKey);
      if (!cached && data.visibilityCache) {
        try {
          await data.visibilityCache.activateContext(
            data.profile.id,
            contextKey,
          );
          cached = await data.visibilityCache.getTrajectory(
            contextKey,
            targetKey,
          );
          if (cached) visibilityCache.set(cacheKey, cached);
        } catch {
          cached = null;
        }
      }
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
        if (data.visibilityCache) {
          void data.visibilityCache
            .putTrajectory(data.profile.id, contextKey, targetKey, result)
            .catch(() => undefined);
        }
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
  const darkAboveHorizonIntervals = useMemo(
    () =>
      trajectory
        ? intersectTimeIntervals(
            trajectory.aboveHorizonIntervals,
            astronomicalDarknessIntervals,
          )
        : [],
    [astronomicalDarknessIntervals, trajectory],
  );
  const darkVisibilityIntervals = useMemo(
    () =>
      trajectory
        ? intersectTimeIntervals(
            trajectory.visibilityIntervals,
            astronomicalDarknessIntervals,
          )
        : [],
    [astronomicalDarknessIntervals, trajectory],
  );
  const darkVisibleMilliseconds = useMemo(
    () =>
      darkVisibilityIntervals.reduce(
        (total, interval) => total + interval.durationMilliseconds,
        0,
      ),
    [darkVisibilityIntervals],
  );
  const darkAboveHorizonMilliseconds = useMemo(
    () =>
      darkAboveHorizonIntervals.reduce(
        (total, interval) => total + interval.durationMilliseconds,
        0,
      ),
    [darkAboveHorizonIntervals],
  );
  const aboveHorizonIntervals = useMemo(
    () =>
      data && trajectory
        ? formatAboveHorizonIntervals(
            darkAboveHorizonIntervals,
            data.profile.timeZoneId,
          )
        : [],
    [darkAboveHorizonIntervals, data, trajectory],
  );
  const visibleIntervals = useMemo(
    () =>
      data && trajectory
        ? formatAboveHorizonIntervals(
            darkVisibilityIntervals,
            data.profile.timeZoneId,
          )
        : [],
    [darkVisibilityIntervals, data, trajectory],
  );
  const selectedFieldOfView = useMemo(
    () =>
      selectedEquipment ? calculateAngularFieldOfView(selectedEquipment) : null,
    [selectedEquipment],
  );
  const selectedTargetSuitability = useMemo(
    () =>
      selectedEquipment && selectedTarget
        ? evaluateEquipmentSuitability(selectedTarget, selectedEquipment)
        : null,
    [selectedEquipment, selectedTarget],
  );
  const focusRequest = useMemo(
    () =>
      selectedDirection && targetFocusRequestId > 0
        ? { direction: selectedDirection, id: targetFocusRequestId }
        : null,
    [selectedDirection, targetFocusRequestId],
  );

  const selectEquipment = async (equipmentId: string) => {
    if (!data) return;
    setMutationError(null);
    try {
      await controller.selectEquipment(data.profile.id, equipmentId);
      setData({ ...data, selectedEquipmentId: equipmentId });
      setOpticsDropdownOpen(false);
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
    setControlTimestampUtc(nextSceneTimestampUtc);
    sceneTimeMilliseconds.set(Date.parse(nextSceneTimestampUtc));
    setObservingWindow(window);
    setInspectedMarker(null);
    if (windowChanged && selectedTarget) {
      setTrajectory(null);
      setTrajectoryStatus('calculating');
    }
  };

  const previewObservingTime = (nextSceneTimestampUtc: string) => {
    sceneTimeMilliseconds.set(Date.parse(nextSceneTimestampUtc));
    const nowMilliseconds = Date.now();
    if (nowMilliseconds - lastControlPreviewMilliseconds.current >= 100) {
      lastControlPreviewMilliseconds.current = nowMilliseconds;
      setControlTimestampUtc(nextSceneTimestampUtc);
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
                void data.visibilityCache
                  ?.invalidateProfile(data.profile.id)
                  .catch(() => undefined);
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

  if (
    !data ||
    !observingWindow ||
    !sceneTimestampUtc ||
    !controlTimestampUtc ||
    !celestialTimeTransform
  ) {
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
            {visibleSuitableTargetCount.toLocaleString()}{' '}
            {data.mask
              ? 'visible suitable targets'
              : 'suitable above horizon · unassessed'}
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
          astronomicalDarknessIntervals={astronomicalDarknessIntervals}
          celestialEquatorDirections={celestialEquatorDirections}
          densityCandidateCount={discoverableCatalogueTargets.length}
          diurnalOrbit={diurnalOrbit}
          fieldOfViewEquipment={selectedEquipment}
          fieldOfViewRotationDegrees={fieldOfViewRotationDegrees}
          focusRequest={focusRequest}
          onInspectTrajectoryMarker={setInspectedMarker}
          onSelectTarget={(target) => {
            setSelectedTarget(target.target);
            setTargetFocusRequestId((current) => current + 1);
            setInspectedMarker(null);
            setTrajectory(null);
            setTrajectoryStatus('calculating');
          }}
          selectedTargetId={selectedTarget?.id ?? null}
          targets={projectedTargets}
          trajectory={trajectory}
          maskPresentation={
            data.mask && maskOpacityPercent > 0
              ? {
                  color: maskColor,
                  mask: data.mask,
                  mode: maskMode,
                  opacityPercent: maskOpacityPercent,
                  panorama: data.panorama,
                }
              : null
          }
          minimumTargetCount={minimumTargetCount}
          constellationOpacityPercent={constellationOpacityPercent}
          celestialTimeTransform={celestialTimeTransform}
          sceneTimeMilliseconds={sceneTimeMilliseconds}
          registeredCelestialSky={registeredCelestialSky}
          registeredCelestialDsoImages={registeredCelestialDsoImages}
          celestialTargets={celestialTargets}
          controlTimeMilliseconds={Date.parse(controlTimestampUtc)}
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
        <View style={styles.viewControls}>
          <Pressable
            accessibilityLabel="View options"
            accessibilityRole="button"
            onPress={() => setOpenSheet('viewOptions')}
            style={({ pressed }) => [
              styles.overlayIconButton,
              pressed && styles.controlPressed,
            ]}
          >
            <AppIcon name="eye" />
          </Pressable>
          <Pressable
            accessibilityLabel="Optics"
            accessibilityRole="button"
            onPress={() => {
              setOpticsDropdownOpen(false);
              setOpenSheet('optics');
            }}
            style={({ pressed }) => [
              styles.overlayIconButton,
              pressed && styles.controlPressed,
            ]}
          >
            <AppIcon name="telescope" />
          </Pressable>
        </View>
        <View style={styles.targetListControl}>
          <Pressable
            accessibilityLabel="View all targets"
            accessibilityRole="button"
            onPress={() =>
              navigation.openTargetList(data.profile.id, observingWindow)
            }
            style={({ pressed }) => [
              styles.overlayIconButton,
              pressed && styles.controlPressed,
            ]}
          >
            <AppIcon name="search" />
          </Pressable>
        </View>
        {selectedTarget ? (
          <View style={styles.targetSummary}>
            <View style={styles.targetSummaryHeading}>
              <View style={styles.targetSummaryCopy}>
                <View style={styles.targetNameRow}>
                  <AppText style={styles.targetName}>
                    {selectedTarget.preferredName}
                  </AppText>
                  <Pressable
                    accessibilityLabel={`More information about ${selectedTarget.preferredName}`}
                    accessibilityRole="button"
                    onPress={() => setOpenSheet('info')}
                    style={styles.infoButton}
                  >
                    <AppIcon name="info" size={20} />
                  </Pressable>
                </View>
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
                    {darkVisibleMilliseconds > 0
                      ? `${formatDuration(darkVisibleMilliseconds)} visible through local obstructions`
                      : 'No visible time through local obstructions'}
                  </AppText>
                  {selectedTargetSuitability?.minorAxisPixels === null ||
                  selectedTargetSuitability?.minorAxisPixels ===
                    undefined ? null : (
                    <AppText tone="muted">
                      About{' '}
                      {Math.round(selectedTargetSuitability.minorAxisPixels)} px
                      along minor axis
                    </AppText>
                  )}
                  <AppText style={styles.transitionText}>
                    {visibleIntervals.length > 0
                      ? `Visibility: ${visibleIntervals.join('; ')}`
                      : 'No visible intervals'}
                  </AppText>
                </>
              ) : (
                <>
                  <AppText style={styles.unassessedText}>
                    Obstructions not assessed
                  </AppText>
                  <AppText tone="muted">
                    {aboveHorizonIntervals.length > 0
                      ? `Astronomical darkness above horizon: ${aboveHorizonIntervals.join('; ')}`
                      : 'No astronomical darkness above the horizon in this window'}
                  </AppText>
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
          </View>
        ) : null}
      </View>

      {mutationError ? (
        <AppText accessibilityLiveRegion="polite" style={styles.errorText}>
          {mutationError}
        </AppText>
      ) : null}

      <ModalSheet
        closeAccessibilityLabel="Close view options"
        onClose={() => setOpenSheet(null)}
        title="View options"
        visible={openSheet === 'viewOptions'}
      >
        <TargetDensitySlider
          onChange={setMinimumTargetCount}
          value={minimumTargetCount}
        />
        <TargetDiscoveryControls
          onSearchTextChange={setTargetSearchText}
          onToggleCategory={toggleTargetCategory}
          searchText={targetSearchText}
          selectedCategories={selectedCategories}
        />
        <ActionButton
          label={`Constellation opacity · ${constellationOpacityPercent}%`}
          onPress={() => setOpenSheet('constellations')}
          variant="secondary"
        />
        {data.mask ? (
          <ActionButton
            label={`Mask appearance · ${maskMode === 'panorama' ? 'Panorama' : 'Color'} · ${maskOpacityPercent}%`}
            onPress={() => setOpenSheet('mask')}
            variant="secondary"
          />
        ) : null}
      </ModalSheet>

      <ModalSheet
        closeAccessibilityLabel="Close constellation controls"
        onClose={() => setOpenSheet('viewOptions')}
        title="Constellations"
        visible={openSheet === 'constellations'}
      >
        <OpacitySlider
          label="Constellation opacity"
          onChange={setConstellationOpacityPercent}
          value={constellationOpacityPercent}
        />
      </ModalSheet>

      <ModalSheet
        closeAccessibilityLabel="Close optics menu"
        onClose={() => setOpenSheet(null)}
        title="Optics"
        visible={openSheet === 'optics'}
      >
        <View style={styles.selectField}>
          <AppText tone="label">Current optics profile</AppText>
          <Pressable
            accessibilityLabel="Choose current optics profile"
            accessibilityRole="button"
            onPress={() => setOpticsDropdownOpen((current) => !current)}
            style={({ pressed }) => [
              styles.selectControl,
              pressed && styles.controlPressed,
            ]}
          >
            <AppText>{selectedEquipment?.name ?? 'None'}</AppText>
            <AppText tone="muted">⌄</AppText>
          </Pressable>
          {opticsDropdownOpen ? (
            <View style={styles.selectOptions}>
              {data.equipment.length === 0 ? (
                <AppText tone="muted">No saved optics profiles</AppText>
              ) : (
                data.equipment.map((item) => (
                  <ActionButton
                    accessibilityLabel={`Use ${item.name} imaging setup`}
                    key={item.id}
                    label={`${item.id === data.selectedEquipmentId ? 'Selected · ' : ''}${item.name}`}
                    onPress={() => void selectEquipment(item.id)}
                    variant={
                      item.id === data.selectedEquipmentId
                        ? 'primary'
                        : 'secondary'
                    }
                  />
                ))
              )}
            </View>
          ) : null}
        </View>
        <ActionButton
          label={`Orientation · ${fieldOfViewRotationDegrees}°`}
          onPress={() => setOpenSheet('orientation')}
          variant="secondary"
        />
      </ModalSheet>

      <ModalSheet
        closeAccessibilityLabel="Close field-of-view orientation"
        onClose={() => setOpenSheet('optics')}
        title="Orientation"
        visible={openSheet === 'orientation'}
      >
        <AngleSlider
          label="Field of view orientation"
          onChange={setFieldOfViewRotationDegrees}
          value={fieldOfViewRotationDegrees}
        />
      </ModalSheet>

      <ModalSheet
        closeAccessibilityLabel="Close mask overlay controls"
        onClose={() => setOpenSheet(null)}
        title="Mask appearance"
        visible={openSheet === 'mask'}
      >
        <MaskAppearanceControls
          color={maskColor}
          mode={maskMode}
          onColorChange={setMaskColor}
          onModeChange={setMaskMode}
          onOpacityChange={setMaskOpacityPercent}
          opacityPercent={maskOpacityPercent}
        />
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
                      ? formatDuration(darkAboveHorizonMilliseconds)
                      : `${formatDuration(darkAboveHorizonMilliseconds)} · local obstructions not assessed`
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
                    ? `${formatDuration(darkVisibleMilliseconds)} · ${visibleIntervals.join('; ') || 'no visible intervals'}`
                    : trajectoryStatus === 'error'
                      ? 'Calculation failed'
                      : 'Calculating'
              }
            />
            <Detail
              label="Selected imaging setup"
              value={
                selectedEquipment && selectedFieldOfView
                  ? `${selectedEquipment.name} · ${selectedFieldOfView.horizontalFovDegrees.toFixed(2)}° × ${selectedFieldOfView.verticalFovDegrees.toFixed(2)}° · ${fieldOfViewRotationDegrees}° rotation`
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

      <ObservingWindowSheet
        observer={observerForProfile(data.profile)}
        onChange={applyObservingTime}
        onPreview={previewObservingTime}
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
  controlPressed: { opacity: 0.72 },
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
  infoButton: {
    alignItems: 'center',
    height: layout.minimumTouchTarget,
    justifyContent: 'center',
    marginVertical: -10,
    width: layout.minimumTouchTarget,
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
  overlayIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.94)',
    borderColor: colors.outline,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    width: 48,
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
  selectControl: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 14,
  },
  selectField: { gap: 6 },
  selectOptions: { gap: 8 },
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
  targetNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
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
    gap: 2,
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
  viewControls: {
    bottom: 12,
    flexDirection: 'row',
    gap: 8,
    left: 12,
    position: 'absolute',
  },
});
