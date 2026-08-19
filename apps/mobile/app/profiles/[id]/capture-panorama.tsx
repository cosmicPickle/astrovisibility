import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { PanoramaCaptureScreen } from '../../../src/capture/PanoramaCaptureScreen';

export default function PanoramaCaptureRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profileId = typeof id === 'string' ? id : '';
  return (
    <PanoramaCaptureScreen
      navigation={{
        goBack: router.back,
        onSaved: () =>
          router.replace(
            `/profiles/${encodeURIComponent(profileId)}/mask` as Href,
          ),
      }}
      profileId={profileId}
    />
  );
}
