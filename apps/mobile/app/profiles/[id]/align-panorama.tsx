import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { PanoramaStitchingScreen } from '../../../src/capture/PanoramaStitchingScreen';

export default function PanoramaStitchingRoute() {
  const router = useRouter();
  const { id, placement } = useLocalSearchParams<{
    id: string;
    placement?: string;
  }>();
  const profileId = typeof id === 'string' ? id : '';
  return (
    <PanoramaStitchingScreen
      useReviewedPlacements={placement === 'reviewed'}
      navigation={{
        backToCapture: () =>
          router.replace(
            `/profiles/${encodeURIComponent(profileId)}/capture-panorama?resume=1` as Href,
          ),
        manual: () =>
          router.replace(
            `/profiles/${encodeURIComponent(profileId)}/adjust-panorama` as Href,
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
