import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { PanoramaAlignmentScreen } from '../../../src/capture/PanoramaAlignmentScreen';

export default function PanoramaAlignmentRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profileId = typeof id === 'string' ? id : '';
  return (
    <PanoramaAlignmentScreen
      navigation={{
        backToCapture: () =>
          router.replace(
            `/profiles/${encodeURIComponent(profileId)}/capture-panorama?resume=1` as Href,
          ),
        onAccepted: () =>
          router.replace(
            `/profiles/${encodeURIComponent(profileId)}/mask` as Href,
          ),
      }}
      profileId={profileId}
    />
  );
}
