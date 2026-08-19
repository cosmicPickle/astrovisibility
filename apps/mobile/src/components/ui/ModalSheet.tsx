import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout } from '../../theme/tokens';
import { ActionButton } from './ActionButton';
import { AppText } from './AppText';

export const ModalSheet = ({
  children,
  closeAccessibilityLabel,
  onClose,
  title,
  visible,
}: PropsWithChildren<{
  closeAccessibilityLabel: string;
  onClose: () => void;
  title: string;
  visible: boolean;
}>) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modal}
      >
        <Pressable
          accessibilityLabel={`Dismiss ${title}`}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.header}>
            <AppText accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
            <ActionButton
              accessibilityLabel={closeAccessibilityLabel}
              label="Close"
              onPress={onClose}
              variant="text"
            />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  content: {
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  modal: {
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingTop: 8,
  },
  title: {
    flex: 1,
    fontSize: 21,
    fontWeight: '800',
    marginRight: layout.sectionGap,
  },
});
