import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { DashboardScreen } from '../src/dashboard/DashboardScreen';

export default function DashboardRoute() {
  const router = useRouter();
  const [reloadToken, setReloadToken] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setReloadToken((current) => current + 1);
    }, []),
  );
  const navigation = useMemo(
    () => ({
      createEquipment: () => router.push('/equipment/new' as Href),
      createProfile: () => router.push('/profiles/new' as Href),
      editEquipment: (id: string) =>
        router.push(`/equipment/${encodeURIComponent(id)}/edit` as Href),
      editProfile: (id: string) =>
        router.push(`/profiles/${encodeURIComponent(id)}/edit` as Href),
      openLicences: () => router.push('/licences'),
      openProfile: (id: string) =>
        router.push(`/profiles/${encodeURIComponent(id)}/sky` as Href),
    }),
    [router],
  );
  return <DashboardScreen navigation={navigation} reloadToken={reloadToken} />;
}
