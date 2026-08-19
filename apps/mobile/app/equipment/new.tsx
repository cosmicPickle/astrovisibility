import { useRouter } from 'expo-router';

import { EquipmentForm } from '../../src/equipment/equipment-form';
import { createEquipmentFormDefaults } from '../../src/equipment/equipmentForm';
import { bootstrapStorage } from '../../src/storage/bootstrapStorage';
import { createLocalRecordId } from '../../src/storage/recordIdentity';

export default function NewEquipmentRoute() {
  const router = useRouter();
  return (
    <EquipmentForm
      initialValues={createEquipmentFormDefaults()}
      onSave={async (data) => {
        const storage = await bootstrapStorage();
        const timestampUtc = new Date().toISOString();
        await storage.equipment.create({
          ...data,
          id: createLocalRecordId('equipment'),
          createdAtUtc: timestampUtc,
          updatedAtUtc: timestampUtc,
        });
        router.back();
      }}
      title="New imaging setup"
    />
  );
}
