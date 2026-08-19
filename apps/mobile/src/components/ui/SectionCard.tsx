import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, layout } from '../../theme/tokens';

export const SectionCard = ({ children }: PropsWithChildren) => (
  <View style={styles.card}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
});
