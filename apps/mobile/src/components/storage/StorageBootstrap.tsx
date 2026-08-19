import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';

import {
  bootstrapStorage,
  maintainStorage,
} from '../../storage/bootstrapStorage';
import { colors, layout } from '../../theme/tokens';
import { ActionButton } from '../ui/ActionButton';
import { AppText } from '../ui/AppText';

type BootstrapState = 'loading' | 'ready' | 'failed';

export const StorageBootstrap = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<BootstrapState>('loading');

  const retry = useCallback(() => {
    setState('loading');
    void bootstrapStorage().then(
      () => setState('ready'),
      () => setState('failed'),
    );
  }, []);

  useEffect(() => {
    let active = true;
    void bootstrapStorage().then(
      () => active && setState('ready'),
      () => active && setState('failed'),
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void bootstrapStorage()
        .then(maintainStorage)
        .catch(() => setState('failed'));
    });
    return () => subscription.remove();
  }, []);

  if (state === 'ready') {
    return children;
  }
  return (
    <View style={styles.container}>
      {state === 'loading' ? (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText tone="muted">Preparing the offline sky catalogue…</AppText>
        </>
      ) : (
        <>
          <AppText tone="title">Local data could not be prepared</AppText>
          <AppText tone="muted">
            Your profiles and captures remain on this device. Try again to open
            the local catalogue.
          </AppText>
          <ActionButton label="Try again" onPress={retry} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: layout.sectionGap,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
});
