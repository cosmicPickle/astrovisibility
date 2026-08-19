import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../../theme/tokens';

export const AppProvider = ({ children }: PropsWithChildren) => (
  <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider>
      <View style={styles.root}>
        <OverlayProvider>
          <ToastProvider>{children}</ToastProvider>
        </OverlayProvider>
      </View>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
