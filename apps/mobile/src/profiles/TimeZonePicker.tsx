import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { colors, layout } from '../theme/tokens';

const maximumVisibleResults = 100;

export function TimeZonePicker({
  onChange,
  options,
  value,
}: Readonly<{
  onChange: (value: string) => void;
  options: readonly string[];
  value: string;
}>) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = normalizedQuery
      ? options.filter((option) =>
          option.toLocaleLowerCase().includes(normalizedQuery),
        )
      : options;
    return matches.slice(0, maximumVisibleResults);
  }, [options, query]);

  return (
    <>
      <Pressable
        accessibilityLabel="Choose timezone"
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <AppText>{value}</AppText>
        <AppText style={styles.chevron}>⌄</AppText>
      </Pressable>
      <ModalSheet
        closeAccessibilityLabel="Close timezone picker"
        onClose={() => setVisible(false)}
        title="Timezone"
        visible={visible}
      >
        <TextInput
          accessibilityLabel="Search timezones"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search timezone"
          placeholderTextColor={colors.mutedText}
          style={styles.search}
          value={query}
        />
        <View>
          {filteredOptions.map((option) => (
            <Pressable
              accessibilityLabel={`Select ${option}`}
              accessibilityRole="button"
              accessibilityState={{ selected: option === value }}
              key={option}
              onPress={() => {
                onChange(option);
                setQuery('');
                setVisible(false);
              }}
              style={({ pressed }) => [
                styles.option,
                option === value && styles.selectedOption,
                pressed && styles.pressed,
              ]}
            >
              <AppText>{option}</AppText>
            </Pressable>
          ))}
        </View>
      </ModalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  chevron: { color: colors.mutedText, fontSize: 18 },
  field: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  option: {
    borderBottomColor: colors.outline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 12,
  },
  pressed: { opacity: 0.75 },
  search: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.outline,
    borderRadius: layout.controlRadius,
    borderWidth: 1,
    color: colors.text,
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: 12,
  },
  selectedOption: { backgroundColor: colors.surfaceElevated },
});
