import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppIcon } from '../components/ui/AppIcon';
import { AppText } from '../components/ui/AppText';
import { colors, layout } from '../theme/tokens';
import { type TargetCategory } from './targetDiscoveryFilter';
import { AdvancedTargetFilterFields } from './AdvancedTargetFilterFields';
import type { useTargetDiscoveryState } from './targetDiscoveryState';

const targetCategories: readonly Readonly<{
  key: TargetCategory;
  label: string;
}>[] = [
  { key: 'galaxies', label: 'Galaxies' },
  { key: 'nebulae', label: 'Nebula' },
  { key: 'starClusters', label: 'Star Clusters' },
];

export function TargetDiscoveryControls({
  discovery,
  hasEquipment,
  showOrder = false,
}: Readonly<{
  discovery: ReturnType<typeof useTargetDiscoveryState>;
  hasEquipment: boolean;
  showOrder?: boolean;
}>) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.entries(discovery.filterLimits).filter(
    ([key, value]) =>
      value !== null && (hasEquipment || key === 'minDurationMinutes'),
  ).length;
  const { searchText, selectedCategories, setSearchText, toggleCategory } =
    discovery;
  return (
    <View style={styles.controls}>
      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Search catalogue numbers or popular names"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearchText}
          placeholder="Search catalogue or name"
          placeholderTextColor={colors.mutedText}
          returnKeyType="search"
          style={styles.searchInput}
          value={searchText}
        />
        <Pressable
          accessibilityLabel="Advanced filters"
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityValue={{
            text:
              activeCount === 1
                ? '1 active filter'
                : `${activeCount} active filters`,
          }}
          onPress={() => setExpanded(!expanded)}
          style={[styles.filterButton, expanded && styles.filterButtonExpanded]}
        >
          <AppIcon name="filter" />
          {activeCount > 0 ? <View style={styles.activeIndicator} /> : null}
        </Pressable>
      </View>
      {expanded ? (
        <AdvancedTargetFilterFields
          discovery={discovery}
          hasEquipment={hasEquipment}
        />
      ) : null}
      <View accessibilityRole="toolbar" style={styles.categoryFilter}>
        {targetCategories.map(({ key, label }, index) => {
          const selected = selectedCategories.includes(key);
          return (
            <Pressable
              accessibilityLabel={`Toggle ${label} filter`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={key}
              onPress={() => toggleCategory(key)}
              style={[
                styles.categorySegment,
                index === 0 && styles.categorySegmentLeft,
                index === targetCategories.length - 1 &&
                  styles.categorySegmentRight,
                selected && styles.categorySegmentSelected,
              ]}
            >
              <AppText
                numberOfLines={1}
                style={
                  selected ? styles.categoryTextSelected : styles.categoryText
                }
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {showOrder ? (
        <View style={styles.orderGroup}>
          <AppText tone="label">Order by:</AppText>
          <View style={styles.categoryFilter}>
            {(
              [
                { key: 'biggest', label: 'Biggest' },
                { key: 'longestVisible', label: 'Longest Visible' },
              ] as const
            ).map(({ key, label }, index) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: discovery.order === key }}
                key={key}
                onPress={() => discovery.setOrder(key)}
                style={[
                  styles.categorySegment,
                  index === 0
                    ? styles.categorySegmentLeft
                    : styles.categorySegmentRight,
                  discovery.order === key && styles.categorySegmentSelected,
                ]}
              >
                <AppText
                  style={
                    discovery.order === key
                      ? styles.categoryTextSelected
                      : styles.categoryText
                  }
                >
                  {label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 8 },
  filterButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: layout.minimumTouchTarget,
    minHeight: layout.minimumTouchTarget,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  filterButtonExpanded: { backgroundColor: colors.primaryPressed },
  activeIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
  },
  orderGroup: { gap: 6 },
  categoryFilter: { flexDirection: 'row' },
  categorySegment: {
    alignItems: 'center',
    borderColor: colors.outline,
    borderLeftWidth: 0,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 5,
  },
  categorySegmentLeft: {
    borderBottomLeftRadius: layout.controlRadius,
    borderLeftWidth: 1,
    borderTopLeftRadius: layout.controlRadius,
  },
  categorySegmentRight: {
    borderBottomRightRadius: layout.controlRadius,
    borderTopRightRadius: layout.controlRadius,
  },
  categorySegmentSelected: { backgroundColor: colors.primaryPressed },
  categoryText: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  categoryTextSelected: { color: colors.text, fontSize: 12, fontWeight: '800' },
  controls: { gap: layout.sectionGap },
  searchInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    color: colors.text,
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 12,
  },
});
