import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { MaskEditorScreen } from '../../../src/mask/MaskEditorScreen';

export default function MaskEditorRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profileId = typeof id === 'string' ? id : '';
  return (
    <MaskEditorScreen
      navigation={{
        goBack: router.back,
        onSaved: () =>
          router.replace(
            `/profiles/${encodeURIComponent(profileId)}/sky` as Href,
          ),
      }}
      profileId={profileId}
    />
  );
}
