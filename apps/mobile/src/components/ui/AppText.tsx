import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '../../theme/tokens';

type AppTextProps = ComponentProps<typeof Text> & {
  tone?: 'body' | 'label' | 'muted' | 'title';
};

export const AppText = ({ style, tone = 'body', ...props }: AppTextProps) => (
  <Text style={[styles.base, styles[tone], style]} {...props} />
);

const styles = StyleSheet.create({
  base: {
    color: colors.text,
    fontSize: typography.body,
  },
  body: {
    lineHeight: 21,
  },
  label: {
    color: colors.mutedText,
    fontSize: typography.label,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  muted: {
    color: colors.mutedText,
    lineHeight: 20,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
});
