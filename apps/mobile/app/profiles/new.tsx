import { useRouter } from 'expo-router';

import { ProfileForm } from '../../src/profiles/profile-form';
import { createProfileFormDefaults } from '../../src/profiles/profileForm';
import { bootstrapStorage } from '../../src/storage/bootstrapStorage';
import { createLocalRecordId } from '../../src/storage/recordIdentity';

export default function NewProfileRoute() {
  const router = useRouter();
  return (
    <ProfileForm
      initialValues={createProfileFormDefaults()}
      onSave={async (data) => {
        const storage = await bootstrapStorage();
        const timestampUtc = new Date().toISOString();
        await storage.profiles.create({
          ...data,
          id: createLocalRecordId('profile'),
          createdAtUtc: timestampUtc,
          updatedAtUtc: timestampUtc,
        });
        router.back();
      }}
      title="New observing profile"
    />
  );
}
