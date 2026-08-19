import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyntheticSkyCanvas } from '../components/sky/SyntheticSkyCanvas';
import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { SectionCard } from '../components/ui/SectionCard';
import { colors, layout } from '../theme/tokens';

export const TechnicalProofScreen = () => {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AppText tone="label">Stage 0 · Technical proof</AppText>
          <AppText tone="title">Sky, mask and capture foundation</AppText>
          <AppText tone="muted">
            Synthetic engineering surface only. Product profile workflows begin
            in later stages.
          </AppText>
        </View>

        <SyntheticSkyCanvas />

        <SectionCard>
          <AppText tone="label">Geometry contract</AppText>
          <AppText>
            Pan and pinch the wrapped 0–360° sky. The blue seam polygon crosses
            north, the narrow dashed stroke blocks part of it, and the violet
            trajectory reaches through the zenith-capable projection.
          </AppText>
        </SectionCard>

        <SectionCard>
          <AppText tone="label">Physical-device proof</AppText>
          <AppText>
            Open one camera preview, record raw motion and heading alongside
            each tile, capture a narrow or overlapping set, then review and
            manually correct its angular placement.
          </AppText>
          <ActionButton
            label="Open capture proof"
            onPress={() => router.push('/capture-proof')}
          />
        </SectionCard>

        <SectionCard>
          <AppText tone="label">Offline data foundation</AppText>
          <AppText>
            The pinned OpenNGC catalogue and complete Caldwell cross-reference
            are stored locally with source and licence provenance.
          </AppText>
          <ActionButton
            label="About and licences"
            onPress={() => router.push('/licences')}
            variant="secondary"
          />
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: layout.sectionGap,
    padding: layout.screenPadding,
  },
  header: {
    gap: 7,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
