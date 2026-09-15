import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { PanoramaCaptureScreen } from '../../../src/capture/PanoramaCaptureScreen';
import { ContinuousCaptureScreen } from '../../../src/capture/ContinuousCaptureScreen';
import { PANORAMA_CAPTURE_MODE } from '../../../src/capture/panoramaCaptureMode';

export default function PanoramaCaptureRoute() {
  const router = useRouter();
  const { id, resume } = useLocalSearchParams<{
    id: string;
    resume?: string;
  }>();
  const profileId = typeof id === 'string' ? id : '';
  const CaptureScreen =
    PANORAMA_CAPTURE_MODE === 'continuous'
      ? ContinuousCaptureScreen
      : PanoramaCaptureScreen;
  return (
    <CaptureScreen
      navigation={{
        goBack: router.back,
        onAlign: () =>
          (PANORAMA_CAPTURE_MODE === 'continuous'
            ? router.replace
            : router.push)(
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
