import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { ActionButton } from '../../../src/components/ui/ActionButton';
import { AppScreen } from '../../../src/components/ui/AppScreen';
import { AppText } from '../../../src/components/ui/AppText';
import { EquipmentForm } from '../../../src/equipment/equipment-form';
import { equipmentToFormValues } from '../../../src/equipment/equipmentForm';
import { bootstrapStorage } from '../../../src/storage/bootstrapStorage';
import type { EquipmentRecord } from '../../../src/storage/equipmentRepository';
import { colors } from '../../../src/theme/tokens';

export default function EditEquipmentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [equipment, setEquipment] = useState<
    EquipmentRecord | null | undefined
  >();

  useEffect(() => {
    let active = true;
    void bootstrapStorage()
      .then((storage) => storage.equipment.getById(id))
      .then(
        (value) => active && setEquipment(value),
        () => active && setEquipment(null),
      );
    return () => {
      active = false;
    };
  }, [id]);

  if (equipment === undefined) {
    return (
      <AppScreen>
        <ActivityIndicator
          accessibilityLabel="Loading imaging setup"
          color={colors.primary}
          size="large"
        />
      </AppScreen>
    );
  }
  if (equipment === null) {
    return (
      <AppScreen>
        <AppText tone="title">Imaging setup unavailable</AppText>
        <AppText tone="muted">
          This local setup no longer exists or could not be read.
        </AppText>
        <ActionButton label="Back to dashboard" onPress={() => router.back()} />
      </AppScreen>
    );
  }

  return (
    <EquipmentForm
      initialValues={equipmentToFormValues(equipment)}
      onSave={async (data) => {
        const storage = await bootstrapStorage();
        await storage.equipment.update(equipment.id, {
          ...data,
          updatedAtUtc: new Date().toISOString(),
        });
        router.back();
      }}
      title="Edit imaging setup"
    />
  );
}
