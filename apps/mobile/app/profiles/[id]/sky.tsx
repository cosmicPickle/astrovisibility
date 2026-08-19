import { useCallback, useState } from 'react';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';

import { SkyViewScreen } from '../../../src/sky/SkyViewScreen';
import {
  consumeSkySelectionHandoff,
  type SkySelectionHandoff,
} from '../../../src/targets/skySelectionHandoff';

export default function ProfileSkyRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profileId = typeof id === 'string' ? id : '';
  const [focusVersion, setFocusVersion] = useState(0);
  const [selectionHandoff, setSelectionHandoff] =
    useState<SkySelectionHandoff | null>(null);
  useFocusEffect(
    useCallback(() => {
      setSelectionHandoff(consumeSkySelectionHandoff(profileId));
      setFocusVersion((current) => current + 1);
    }, [profileId]),
  );
  return (
    <SkyViewScreen
      initialObservingWindow={
        selectionHandoff
          ? {
              kind: 'custom',
              ...selectionHandoff.window,
              note: null,
              warnings: [],
            }
          : undefined
      }
      initialSelectedTargetId={selectionHandoff?.targetId}
      key={focusVersion}
      navigation={{
        editProfile: (selectedProfileId) =>
          router.push(
            `/profiles/${encodeURIComponent(selectedProfileId)}/edit` as Href,
          ),
        goBack: router.back,
        openLicences: () => router.push('/licences'),
        openMaskEditor: (selectedProfileId) =>
          router.push(
            `/profiles/${encodeURIComponent(selectedProfileId)}/mask` as Href,
          ),
        openPanoramaCapture: (selectedProfileId) =>
          router.push(
            `/profiles/${encodeURIComponent(selectedProfileId)}/capture-panorama` as Href,
          ),
        openTargetList: (selectedProfileId, window) =>
          router.push(
            `/profiles/${encodeURIComponent(selectedProfileId)}/targets?startTimestampUtc=${encodeURIComponent(window.startTimestampUtc)}&endTimestampUtc=${encodeURIComponent(window.endTimestampUtc)}` as Href,
          ),
      }}
      profileId={profileId}
    />
  );
}
