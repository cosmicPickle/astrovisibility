import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { ActionButton } from '../../../src/components/ui/ActionButton';
import { AppScreen } from '../../../src/components/ui/AppScreen';
import { AppText } from '../../../src/components/ui/AppText';
import { ProfileForm } from '../../../src/profiles/profile-form';
import { profileToFormValues } from '../../../src/profiles/profileForm';
import { bootstrapStorage } from '../../../src/storage/bootstrapStorage';
import type { ProfileRecord } from '../../../src/storage/profileRepository';
import { colors } from '../../../src/theme/tokens';

export default function EditProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRecord | null | undefined>();

  useEffect(() => {
    let active = true;
    void bootstrapStorage()
      .then((storage) => storage.profiles.getById(id))
      .then(
        (value) => active && setProfile(value),
        () => active && setProfile(null),
      );
    return () => {
      active = false;
    };
  }, [id]);

  if (profile === undefined) {
    return (
      <AppScreen>
        <ActivityIndicator
          accessibilityLabel="Loading profile"
          color={colors.primary}
          size="large"
        />
      </AppScreen>
    );
  }
  if (profile === null) {
    return (
      <AppScreen>
        <AppText tone="title">Profile unavailable</AppText>
        <AppText tone="muted">
          This local profile no longer exists or could not be read.
        </AppText>
        <ActionButton label="Back to dashboard" onPress={() => router.back()} />
      </AppScreen>
    );
  }

  return (
    <ProfileForm
      initialValues={profileToFormValues(profile)}
      onSave={async (data) => {
        const storage = await bootstrapStorage();
        await storage.profiles.update(profile.id, {
          ...data,
          updatedAtUtc: new Date().toISOString(),
        });
        router.back();
      }}
      title="Edit observing profile"
    />
  );
}
