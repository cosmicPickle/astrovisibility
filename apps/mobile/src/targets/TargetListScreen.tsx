import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogueTarget } from '../../scripts/catalogue/catalogueImporter';
import type {
  ObstructionVisibilityInput,
  VisibilityCalculationOptions,
} from '../astronomy/obstructionVisibility';
import {
  localCivilDateTimeAtInstant,
  type ObservingWindow,
} from '../astronomy/localCivilTime';
import { createTonightObservingWindow } from '../astronomy/observingWindow';
import {
  formatAboveHorizonIntervals,
  formatDuration,
  formatObservingWindowRange,
} from '../astronomy/observingWindowPresentation';
import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActiveMaskRevision } from '../storage/maskRepository';
import type { ProfileRecord } from '../storage/profileRepository';
import { colors, layout } from '../theme/tokens';
import {
  calculateRankedTargetsProgressively,
  TargetListCalculationCancelledError,
  type RankedTarget,
  type RankedTargetProgress,
} from './rankedTargetCalculation';

export type TargetListData = Readonly<{
  equipment: EquipmentRecord | null;
  maskRevision: ActiveMaskRevision | null;
  panoramaRevisionId: string | null;
  profile: ProfileRecord;
  targets: readonly CatalogueTarget[];
  window: ObservingWindow;
}>;

export interface TargetListController {
  load(
    profileId: string,
    requestedWindow?: ObservingWindow,
  ): Promise<TargetListData>;
}

export interface TargetListNavigation {
  goBack(): void;
  selectTarget(
    profileId: string,
    targetId: string,
    window: ObservingWindow,
  ): void;
}

type CalculateVisibility = (
  input: ObstructionVisibilityInput,
  options?: VisibilityCalculationOptions,
) => Promise<SelectedTargetTrajectory>;

const observerForProfile = (profile: ProfileRecord) => ({
  latitudeDegreesNorth: profile.latitudeDegreesNorth,
  longitudeDegreesEast: profile.longitudeDegreesEast,
  elevationMetersAboveMeanSeaLevel: profile.elevationMetersAboveMeanSeaLevel,
});

export const targetListController: TargetListController = {
  async load(profileId, requestedWindow) {
    const storage = await bootstrapStorage();
    const [profile, targets, equipment, maskRevision, panorama] =
      await Promise.all([
        storage.profiles.getById(profileId),
        storage.catalogue.listAll(),
        storage.equipment.getSelectedForProfile(profileId),
        storage.masks.getActiveForProfile(profileId),
        storage.panoramas.getActiveForProfile(profileId),
      ]);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    const nowTimestampUtc = new Date().toISOString();
    const localDate = localCivilDateTimeAtInstant(
      nowTimestampUtc,
      profile.timeZoneId,
    );
    return {
      equipment,
      maskRevision,
      panoramaRevisionId: panorama?.id ?? null,
      profile,
      targets,
      window:
        requestedWindow ??
        createTonightObservingWindow({
          civilDate: localDate,
          observer: observerForProfile(profile),
          timeZoneId: profile.timeZoneId,
        }),
    };
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
    .slice(0, 4)
    .join(' · ') || target.id;

const emptyProgress: RankedTargetProgress = {
  complete: false,
  eligibleTargetCount: 0,
  processedCount: 0,
  rejectedByEquipmentCount: 0,
  results: [],
  totalCatalogueCount: 0,
};

export function TargetListScreen({
  calculateVisibility,
  controller = targetListController,
  navigation,
  profileId,
  requestedWindow,
}: Readonly<{
  calculateVisibility?: CalculateVisibility;
  controller?: TargetListController;
  navigation: TargetListNavigation;
  profileId: string;
  requestedWindow?: ObservingWindow;
}>) {
  const [data, setData] = useState<TargetListData | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [calculationStatus, setCalculationStatus] = useState<
    'idle' | 'calculating' | 'complete' | 'cancelled' | 'error'
  >('idle');
  const [progress, setProgress] = useState<RankedTargetProgress>(emptyProgress);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [calculationAttempt, setCalculationAttempt] = useState(0);
  const activeCalculation = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void controller.load(profileId, requestedWindow).then(
      (loaded) => {
        if (!active) return;
        setData(loaded);
        setLoadStatus('ready');
        setProgress({
          ...emptyProgress,
          eligibleTargetCount: loaded.targets.length,
          totalCatalogueCount: loaded.targets.length,
        });
        setCalculationStatus('calculating');
      },
      () => {
        if (!active) return;
        setData(null);
        setLoadStatus('error');
      },
    );
    return () => {
      active = false;
    };
  }, [controller, loadAttempt, profileId, requestedWindow]);

  useEffect(() => {
    if (!data) return;
    const abortController = new AbortController();
    activeCalculation.current?.abort();
    activeCalculation.current = abortController;
    let active = true;
    void calculateRankedTargetsProgressively(
      {
        equipment: data.equipment,
        maskRevision: data.maskRevision,
        observer: observerForProfile(data.profile),
        panoramaRevisionId: data.panoramaRevisionId,
        profileId: data.profile.id,
        targets: data.targets,
        timeZoneId: data.profile.timeZoneId,
        window: data.window,
      },
      {
        calculateVisibility,
        onProgress: (nextProgress) => {
          if (active && !abortController.signal.aborted) {
            setProgress(nextProgress);
          }
        },
        signal: abortController.signal,
      },
    ).then(
      () => {
        if (active && !abortController.signal.aborted) {
          setCalculationStatus('complete');
        }
      },
      (error: unknown) => {
        if (!active) return;
        if (
          abortController.signal.aborted ||
          error instanceof TargetListCalculationCancelledError
        ) {
          setCalculationStatus('cancelled');
          return;
        }
        setCalculationStatus('error');
      },
    );
    return () => {
      active = false;
      abortController.abort();
    };
  }, [calculateVisibility, calculationAttempt, data]);

  const cancelCalculation = useCallback(() => {
    activeCalculation.current?.abort();
    setCalculationStatus('cancelled');
  }, []);
  const retryCalculation = useCallback(() => {
    if (!data) return;
    setProgress({
      ...emptyProgress,
      eligibleTargetCount: data.targets.length,
      totalCatalogueCount: data.targets.length,
    });
    setCalculationStatus('calculating');
    setCalculationAttempt((attempt) => attempt + 1);
  }, [data]);

  if (loadStatus !== 'ready' || !data) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.centered}>
        {loadStatus === 'error' ? (
          <>
            <AppText tone="title">Target list unavailable</AppText>
            <AppText tone="muted">
              The profile or offline catalogue could not be read from this
              device.
            </AppText>
            <ActionButton
              label="Try again"
              onPress={() => {
                setLoadStatus('loading');
                setLoadAttempt((attempt) => attempt + 1);
              }}
            />
            <ActionButton
              label="Back to Sky View"
              onPress={navigation.goBack}
              variant="secondary"
            />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <AppText tone="muted">Preparing the offline catalogue…</AppText>
          </>
        )}
      </SafeAreaView>
    );
  }

  const emptyMessage =
    calculationStatus === 'complete' && progress.results.length === 0
      ? progress.eligibleTargetCount === 0
        ? 'No catalogue targets fit the selected imaging setup.'
        : 'No eligible catalogue targets rise during this observing window.'
      : null;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={progress.results}
        initialNumToRender={8}
        keyExtractor={({ target }) => target.id}
        ListEmptyComponent={
          emptyMessage ? (
            <View style={styles.emptyState}>
              <AppText tone="title">No targets to show</AppText>
              <AppText tone="muted">{emptyMessage}</AppText>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <TargetListHeader
            calculationStatus={calculationStatus}
            data={data}
            onBack={navigation.goBack}
            onCancel={cancelCalculation}
            onRetry={retryCalculation}
            progress={progress}
          />
        }
        maxToRenderPerBatch={8}
        renderItem={({ item }) => (
          <TargetRow
            item={item}
            onPress={() =>
              navigation.selectTarget(
                data.profile.id,
                item.target.id,
                data.window,
              )
            }
            timeZoneId={data.profile.timeZoneId}
          />
        )}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        testID="ranked-target-list"
        windowSize={7}
      />
    </SafeAreaView>
  );
}

function TargetListHeader({
  calculationStatus,
  data,
  onBack,
  onCancel,
  onRetry,
  progress,
}: Readonly<{
  calculationStatus:
    'idle' | 'calculating' | 'complete' | 'cancelled' | 'error';
  data: TargetListData;
  onBack: () => void;
  onCancel: () => void;
  onRetry: () => void;
  progress: RankedTargetProgress;
}>) {
  const percent =
    progress.eligibleTargetCount === 0
      ? 100
      : Math.round(
          (progress.processedCount / progress.eligibleTargetCount) * 100,
        );
  return (
    <View style={styles.headerGroup}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back to Sky View"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
        >
          <AppText style={styles.backGlyph}>‹</AppText>
        </Pressable>
        <View style={styles.headingCopy}>
          <AppText tone="label">{data.profile.name}</AppText>
          <AppText tone="title">View All Targets</AppText>
        </View>
      </View>
      <AppText tone="muted">
        {formatObservingWindowRange(data.window, data.profile.timeZoneId)}
      </AppText>
      <View style={styles.explanationCard}>
        <AppText style={styles.explanationTitle}>
          {data.equipment
            ? `Filtered for ${data.equipment.name}`
            : 'No imaging setup filter'}
        </AppText>
        <AppText tone="muted">
          {data.equipment
            ? 'Known-size targets must fit within 90% of the frame and span at least 8 sensor pixels. Unknown sizes stay included and are labelled.'
            : 'All targets that rise in this observing window remain eligible.'}
        </AppText>
        {progress.rejectedByEquipmentCount > 0 ? (
          <AppText tone="muted">
            {progress.rejectedByEquipmentCount.toLocaleString()} clearly
            unsuitable targets filtered before visibility calculation.
          </AppText>
        ) : null}
      </View>
      {!data.maskRevision ? (
        <View style={styles.unassessedCard}>
          <AppText style={styles.explanationTitle}>
            Local obstructions not assessed
          </AppText>
          <AppText tone="muted">
            This profile has no completed mask. Ranking uses astronomical time
            above the horizon only.
          </AppText>
        </View>
      ) : null}
      {calculationStatus === 'calculating' ? (
        <View style={styles.progressCard}>
          <View style={styles.progressCopy}>
            <ActivityIndicator color={colors.primary} size="small" />
            <AppText accessibilityLiveRegion="polite">
              Calculating {progress.processedCount.toLocaleString()} of{' '}
              {progress.eligibleTargetCount.toLocaleString()} · {percent}%
            </AppText>
          </View>
          <ActionButton
            label="Cancel calculation"
            onPress={onCancel}
            variant="secondary"
          />
        </View>
      ) : calculationStatus === 'cancelled' ? (
        <View style={styles.progressCard}>
          <AppText accessibilityLiveRegion="polite" style={styles.statusTitle}>
            Calculation cancelled
          </AppText>
          <AppText tone="muted">
            Partial results remain below. Your profile was not changed.
          </AppText>
          <ActionButton label="Calculate again" onPress={onRetry} />
        </View>
      ) : calculationStatus === 'error' ? (
        <View style={styles.progressCard}>
          <AppText accessibilityLiveRegion="polite" style={styles.errorText}>
            Target visibility could not be calculated.
          </AppText>
          <AppText tone="muted">Partial results remain available.</AppText>
          <ActionButton label="Try calculation again" onPress={onRetry} />
        </View>
      ) : calculationStatus === 'complete' ? (
        <AppText accessibilityLiveRegion="polite" tone="muted">
          {progress.results.length.toLocaleString()} targets ranked ·{' '}
          {progress.eligibleTargetCount.toLocaleString()} calculated
        </AppText>
      ) : null}
    </View>
  );
}

function TargetRow({
  item,
  onPress,
  timeZoneId,
}: Readonly<{
  item: RankedTarget;
  onPress: () => void;
  timeZoneId: string;
}>) {
  const intervalLabels = formatAboveHorizonIntervals(
    item.intervals,
    timeZoneId,
  );
  return (
    <Pressable
      accessibilityLabel={`Inspect ${item.target.preferredName} in Sky View`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.targetRow, pressed && styles.pressed]}
    >
      <View style={styles.rowHeading}>
        <View style={styles.rowHeadingCopy}>
          <AppText style={styles.targetName}>
            {item.target.preferredName}
          </AppText>
          <AppText numberOfLines={2} tone="muted">
            {aliasesFor(item.target)}
          </AppText>
        </View>
        <AppText style={styles.chevron}>›</AppText>
      </View>
      <AppText style={styles.durationText}>
        {item.durationKind === 'visible'
          ? `Total visible: ${formatDuration(item.totalDurationMilliseconds)}`
          : `Above horizon: ${formatDuration(item.totalDurationMilliseconds)} · obstructions not assessed`}
      </AppText>
      <AppText tone="muted">
        {intervalLabels.length > 0
          ? intervalLabels.join(' · ')
          : item.durationKind === 'visible'
            ? 'No visible intervals through local obstructions'
            : 'No above-horizon intervals'}
      </AppText>
      {item.suitability ? (
        <AppText style={styles.suitabilityText}>
          {item.suitability.explanation}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    height: layout.minimumTouchTarget,
    justifyContent: 'center',
    width: layout.minimumTouchTarget,
  },
  backGlyph: { fontSize: 34, lineHeight: 36 },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: layout.sectionGap,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  chevron: { color: colors.primary, fontSize: 30 },
  content: {
    gap: 10,
    padding: layout.screenPadding,
    paddingBottom: 32,
  },
  durationText: { color: colors.text, fontWeight: '800' },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  errorText: { color: colors.danger, fontWeight: '800' },
  explanationCard: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  explanationTitle: { fontWeight: '800' },
  headerGroup: { gap: layout.sectionGap, paddingBottom: 6 },
  headingCopy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.76 },
  progressCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  progressCopy: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  rowHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowHeadingCopy: { flex: 1, gap: 2 },
  screen: { backgroundColor: colors.background, flex: 1 },
  statusTitle: { fontWeight: '800' },
  suitabilityText: { color: colors.spaceViolet, fontSize: 13 },
  targetName: { fontSize: 18, fontWeight: '800' },
  targetRow: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    gap: 7,
    minHeight: layout.minimumTouchTarget,
    padding: 14,
  },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  unassessedCard: {
    backgroundColor: 'rgba(138, 125, 255, 0.10)',
    borderColor: colors.spaceViolet,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
});
