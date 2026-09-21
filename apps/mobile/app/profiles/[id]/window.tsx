import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { WindowEditorScreen } from '../../../src/window/WindowEditorScreen';
import { selectedTrajectoryCache } from '../../../src/astronomy/obstructionVisibility';

export default function WindowEditorRoute() {
  const router = useRouter();
  const { id, setup } = useLocalSearchParams<{ id: string; setup?: string }>();
  const profileId = typeof id === 'string' ? id : '';
  const leave = () =>
    setup === '1'
      ? router.replace(`/profiles/${encodeURIComponent(profileId)}/sky` as Href)
      : router.back();
  return (
    <WindowEditorScreen
      profileId={profileId}
      creation={setup === '1'}
      navigation={{
        goBack: leave,
        onSaved: () => {
          selectedTrajectoryCache.invalidateProfile(profileId);
          leave();
        },
      }}
    />
  );
}
