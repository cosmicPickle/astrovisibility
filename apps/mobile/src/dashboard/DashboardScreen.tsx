import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateEquipmentPreview } from '../equipment/equipmentForm';
import { bootstrapStorage } from '../storage/bootstrapStorage';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import { removeOrphanedOwnedFiles } from '../storage/panoramaPersistence';
import type { ProfileRecord } from '../storage/profileRepository';
import { colors, layout } from '../theme/tokens';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { SectionCard } from '../components/ui/SectionCard';
import { AppScreen } from '../components/ui/AppScreen';

export interface DashboardData {
  equipment: EquipmentRecord[];
  profiles: ProfileRecord[];
  selectedEquipmentIdByProfile: Record<string, string>;
}

export interface DashboardController {
  deleteEquipment(id: string): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  load(): Promise<DashboardData>;
  selectEquipment(profileId: string, equipmentId: string): Promise<void>;
}

export interface DashboardNavigation {
  createEquipment(): void;
  createProfile(): void;
  editEquipment(id: string): void;
  editProfile(id: string): void;
  openLicences(): void;
  openProfile(id: string): void;
}

export const dashboardController: DashboardController = {
  async load() {
    const storage = await bootstrapStorage();
    const [profiles, equipment, selectedEquipmentIdByProfile] =
      await Promise.all([
        storage.profiles.list(),
        storage.equipment.list(),
        storage.equipment.listSelectionIdsByProfile(),
      ]);
    return { profiles, equipment, selectedEquipmentIdByProfile };
  },
  async selectEquipment(profileId, equipmentId) {
    const storage = await bootstrapStorage();
    await storage.equipment.selectForProfile(profileId, equipmentId);
  },
  async deleteEquipment(id) {
    const storage = await bootstrapStorage();
    await storage.equipment.delete(id);
  },
  async deleteProfile(id) {
    const storage = await bootstrapStorage();
    await storage.profiles.delete(id);
    await removeOrphanedOwnedFiles(storage.database, storage.files);
  },
};

interface DashboardScreenProps {
  controller?: DashboardController;
  navigation: DashboardNavigation;
  reloadToken?: number;
}

export const DashboardScreen = ({
  controller = dashboardController,
  navigation,
  reloadToken = 0,
}: DashboardScreenProps) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      setData(await controller.load());
    } catch {
      setError(
        'Profiles and imaging setups could not be read from this device.',
      );
    }
  };

  useEffect(() => {
    let active = true;
    void controller.load().then(
      (loadedData) => {
        if (!active) return;
        setError(null);
        setData(loadedData);
      },
      () => {
        if (!active) return;
        setError(
          'Profiles and imaging setups could not be read from this device.',
        );
      },
    );
    return () => {
      active = false;
    };
  }, [controller, reloadToken]);

  const selectEquipment = async (profileId: string, equipmentId: string) => {
    setMutationError(null);
    try {
      await controller.selectEquipment(profileId, equipmentId);
      setData((current) =>
        current
          ? {
              ...current,
              selectedEquipmentIdByProfile: {
                ...current.selectedEquipmentIdByProfile,
                [profileId]: equipmentId,
              },
            }
          : current,
      );
    } catch {
      setMutationError('The selected setup could not be saved. Try again.');
    }
  };

  const deleteProfile = async (profile: ProfileRecord) => {
    setMutationError(null);
    try {
      await controller.deleteProfile(profile.id);
      await load();
    } catch {
      setMutationError(
        `“${profile.name}” could not be deleted completely. Try again.`,
      );
    }
  };

  const deleteEquipment = async (equipment: EquipmentRecord) => {
    setMutationError(null);
    try {
      await controller.deleteEquipment(equipment.id);
      await load();
    } catch {
      setMutationError(`“${equipment.name}” could not be deleted. Try again.`);
    }
  };

  const confirmProfileDelete = (profile: ProfileRecord) => {
    Alert.alert(
      'Delete observing profile?',
      `“${profile.name}” and its local panorama and mask data will be removed from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete profile',
          style: 'destructive',
          onPress: () => void deleteProfile(profile),
        },
      ],
    );
  };

  const confirmEquipmentDelete = (equipment: EquipmentRecord) => {
    const affectedCount = data
      ? Object.values(data.selectedEquipmentIdByProfile).filter(
          (id) => id === equipment.id,
        ).length
      : 0;
    const effect =
      affectedCount === 0
        ? 'No observing profile currently uses it.'
        : `${affectedCount} affected profile${affectedCount === 1 ? '' : 's'} will use the next saved setup, if one exists.`;
    Alert.alert(
      'Delete imaging setup?',
      `“${equipment.name}” will be removed. ${effect}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete setup',
          style: 'destructive',
          onPress: () => void deleteEquipment(equipment),
        },
      ],
    );
  };

  if (!data && !error) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator
          accessibilityLabel="Loading local setup"
          color={colors.primary}
          size="large"
        />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.centered}>
        <AppText tone="title">Local setup unavailable</AppText>
        <AppText tone="muted">{error}</AppText>
        <ActionButton label="Try again" onPress={() => void load()} />
      </SafeAreaView>
    );
  }

  return (
    <AppScreen includeTopInset>
      <View style={styles.hero}>
        <AppText tone="label">Local sky planner</AppText>
        <AppText style={styles.appTitle}>Astrovisibility</AppText>
        <AppText tone="muted">
          Plan from the exact position where your telescope sees the sky.
        </AppText>
      </View>

      {mutationError ? (
        <AppText accessibilityLiveRegion="polite" style={styles.errorText}>
          {mutationError}
        </AppText>
      ) : null}

      <DashboardSectionHeader
        actionLabel="New profile"
        onAction={navigation.createProfile}
        title="Observing profiles"
      />
      {data.profiles.length === 0 ? (
        <EmptyState
          actionLabel="Create profile"
          body="Save one exact observing position using current location or manual coordinates."
          onAction={navigation.createProfile}
          title="No observing profiles yet"
        />
      ) : (
        data.profiles.map((profile) => (
          <SectionCard key={profile.id}>
            <View style={styles.cardHeading}>
              <View style={styles.cardTitle}>
                <AppText style={styles.cardName}>{profile.name}</AppText>
                <AppText tone="muted">
                  {profile.timeZoneId} · Location saved locally
                </AppText>
              </View>
              <ActionButton
                accessibilityLabel={`Edit ${profile.name}`}
                label="Edit"
                onPress={() => navigation.editProfile(profile.id)}
                variant="text"
              />
            </View>
            <AppText tone="label">Imaging setup for this profile</AppText>
            {data.equipment.length === 0 ? (
              <AppText tone="muted">
                No setup yet. The Sky View will remain usable without one.
              </AppText>
            ) : (
              <View style={styles.selectionWrap}>
                {data.equipment.map((item) => {
                  const selected =
                    data.selectedEquipmentIdByProfile[profile.id] === item.id;
                  return (
                    <Pressable
                      accessibilityLabel={`Use ${item.name} with ${profile.name}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={item.id}
                      onPress={() => void selectEquipment(profile.id, item.id)}
                      style={({ pressed }) => [
                        styles.selection,
                        selected && styles.selectionSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <AppText
                        style={
                          selected ? styles.selectionSelectedText : undefined
                        }
                      >
                        {selected ? 'Selected · ' : ''}
                        {item.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <ActionButton
              accessibilityLabel={`Open ${profile.name} Sky View`}
              label="Open Sky View"
              onPress={() => navigation.openProfile(profile.id)}
            />
            <ActionButton
              accessibilityLabel={`Delete ${profile.name}`}
              label="Delete profile"
              onPress={() => confirmProfileDelete(profile)}
              variant="danger"
            />
          </SectionCard>
        ))
      )}

      <DashboardSectionHeader
        actionLabel="New setup"
        onAction={navigation.createEquipment}
        title="Telescope & camera"
      />
      {data.equipment.length === 0 ? (
        <EmptyState
          actionLabel="Create setup"
          body="Enter your telescope and camera dimensions to preview their field of view."
          onAction={navigation.createEquipment}
          title="No imaging setups yet"
        />
      ) : (
        data.equipment.map((item) => {
          const preview = calculateEquipmentPreview(item);
          return (
            <SectionCard key={item.id}>
              <View style={styles.cardHeading}>
                <View style={styles.cardTitle}>
                  <AppText style={styles.cardName}>{item.name}</AppText>
                  <AppText tone="muted">
                    {item.focalLengthMillimeters} mm focal ·{' '}
                    {item.apertureMillimeters} mm aperture
                  </AppText>
                </View>
                <ActionButton
                  accessibilityLabel={`Edit ${item.name}`}
                  label="Edit"
                  onPress={() => navigation.editEquipment(item.id)}
                  variant="text"
                />
              </View>
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <AppText tone="label">Field</AppText>
                  <AppText style={styles.metricValue}>
                    {preview.horizontalFovDegrees.toFixed(2)}° ×{' '}
                    {preview.verticalFovDegrees.toFixed(2)}°
                  </AppText>
                </View>
                <View style={styles.metric}>
                  <AppText tone="label">Sensor</AppText>
                  <AppText style={styles.metricValue}>
                    {item.sensorWidthMillimeters} ×{' '}
                    {item.sensorHeightMillimeters} mm
                  </AppText>
                </View>
              </View>
              <ActionButton
                accessibilityLabel={`Delete ${item.name}`}
                label="Delete setup"
                onPress={() => confirmEquipmentDelete(item)}
                variant="danger"
              />
            </SectionCard>
          );
        })
      )}

      <ActionButton
        label="About and licences"
        onPress={navigation.openLicences}
        variant="text"
      />
    </AppScreen>
  );
};

const DashboardSectionHeader = ({
  actionLabel,
  onAction,
  title,
}: {
  actionLabel: string;
  onAction: () => void;
  title: string;
}) => (
  <View style={styles.sectionHeader}>
    <AppText style={styles.sectionTitle}>{title}</AppText>
    <ActionButton label={actionLabel} onPress={onAction} variant="secondary" />
  </View>
);

const EmptyState = ({
  actionLabel,
  body,
  onAction,
  title,
}: {
  actionLabel: string;
  body: string;
  onAction: () => void;
  title: string;
}) => (
  <SectionCard>
    <AppText style={styles.cardName}>{title}</AppText>
    <AppText tone="muted">{body}</AppText>
    <ActionButton label={actionLabel} onPress={onAction} />
  </SectionCard>
);

const styles = StyleSheet.create({
  appTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  cardHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardTitle: {
    flex: 1,
    gap: 3,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: layout.sectionGap,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  errorText: {
    color: colors.danger,
  },
  hero: {
    gap: 6,
    paddingBottom: 6,
  },
  metric: {
    flex: 1,
    gap: 4,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricValue: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  selection: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 13,
  },
  selectionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectionSelectedText: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
  selectionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
