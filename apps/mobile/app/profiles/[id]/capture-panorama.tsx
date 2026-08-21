import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { PanoramaCaptureScreen } from '../../../src/capture/PanoramaCaptureScreen';

export default function PanoramaCaptureRoute() {
  const router = useRouter();
  const { id, resume } = useLocalSearchParams<{
    id: string;
    resume?: string;
  }>();
  const profileId = typeof id === 'string' ? id : '';
  return (
    <PanoramaCaptureScreen
      navigation={{
        goBack: router.back,
        onAlign: () =>
          router.push(
            `/profiles/${encodeURIComponent(profileId)}/align-panorama` as Href,
          ),
        onSaved: () =>
          router.replace(
            `/profiles/${encodeURIComponent(profileId)}/mask` as Href,
          ),
      }}
      profileId={profileId}
      startInCaptureMode={resume === '1'}
    />
  );
}
