import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { ObservingWindow } from '../../../src/astronomy/localCivilTime';
import {
  TargetListScreen,
  type TargetListNavigation,
} from '../../../src/targets/TargetListScreen';
import { publishSkySelectionHandoff } from '../../../src/targets/skySelectionHandoff';

const requestedWindowFrom = (
  startTimestampUtc: string | undefined,
  endTimestampUtc: string | undefined,
): ObservingWindow | undefined => {
  if (!startTimestampUtc || !endTimestampUtc) return undefined;
  const startMilliseconds = Date.parse(startTimestampUtc);
  const endMilliseconds = Date.parse(endTimestampUtc);
  if (
    !startTimestampUtc.endsWith('Z') ||
    !endTimestampUtc.endsWith('Z') ||
    Number.isNaN(startMilliseconds) ||
    Number.isNaN(endMilliseconds) ||
    endMilliseconds <= startMilliseconds ||
    endMilliseconds - startMilliseconds > 24 * 60 * 60 * 1000
  ) {
    return undefined;
  }
  return {
    kind: 'custom',
    startTimestampUtc,
    endTimestampUtc,
    note: null,
    warnings: [],
  };
};

export default function TargetListRoute() {
  const router = useRouter();
  const { endTimestampUtc, id, startTimestampUtc } = useLocalSearchParams<{
    endTimestampUtc?: string;
    id: string;
    startTimestampUtc?: string;
  }>();
  const profileId = typeof id === 'string' ? id : '';
  const requestedWindow = useMemo(
    () =>
      requestedWindowFrom(
        typeof startTimestampUtc === 'string' ? startTimestampUtc : undefined,
        typeof endTimestampUtc === 'string' ? endTimestampUtc : undefined,
      ),
    [endTimestampUtc, startTimestampUtc],
  );
  const navigation: TargetListNavigation = {
    goBack: router.back,
    selectTarget: (selectedProfileId, targetId, window) => {
      publishSkySelectionHandoff({
        profileId: selectedProfileId,
        targetId,
        window,
      });
      router.back();
    },
  };
  return (
    <TargetListScreen
      navigation={navigation}
      profileId={profileId}
      requestedWindow={requestedWindow}
    />
  );
}
