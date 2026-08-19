import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout } from '../../theme/tokens';

interface AppScreenProps extends PropsWithChildren {
  includeTopInset?: boolean;
}

export const AppScreen = ({ children, includeTopInset }: AppScreenProps) => (
  <SafeAreaView
    edges={includeTopInset ? ['top', 'bottom'] : ['bottom']}
    style={styles.safeArea}
  >
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: layout.sectionGap,
    padding: layout.screenPadding,
    paddingBottom: 32,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
