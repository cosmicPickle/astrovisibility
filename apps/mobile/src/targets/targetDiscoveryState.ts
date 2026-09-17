import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_TARGET_FILTER_INPUTS,
  DEFAULT_TARGET_FILTER_LIMITS,
  resolveTargetFilterInputs,
  type TargetFilterInputs,
  type TargetFilterLimits,
  type TargetOrder,
} from './advancedTargetFilters';

import {
  ALL_TARGET_CATEGORIES,
  type TargetCategory,
} from './targetDiscoveryFilter';

export type TargetDiscoverySnapshot = Readonly<{
  filterInputs: TargetFilterInputs;
  filterLimits: TargetFilterLimits;
  order: TargetOrder;
  searchText: string;
  selectedCategories: readonly TargetCategory[];
}>;

const defaultSnapshot: TargetDiscoverySnapshot = Object.freeze({
  filterInputs: DEFAULT_TARGET_FILTER_INPUTS,
  filterLimits: DEFAULT_TARGET_FILTER_LIMITS,
  order: 'longestVisible',
  searchText: '',
  selectedCategories: Object.freeze([...ALL_TARGET_CATEGORIES]),
});
const snapshots = new Map<string, TargetDiscoverySnapshot>();
const listeners = new Map<string, Set<() => void>>();

export const getTargetDiscoverySnapshot = (
  profileId: string,
): TargetDiscoverySnapshot => snapshots.get(profileId) ?? defaultSnapshot;

export const subscribeToTargetDiscoveryState = (
  profileId: string,
  listener: () => void,
): (() => void) => {
  const profileListeners = listeners.get(profileId) ?? new Set();
  profileListeners.add(listener);
  listeners.set(profileId, profileListeners);
  return () => {
    profileListeners.delete(listener);
    if (profileListeners.size === 0) listeners.delete(profileId);
  };
};

const publish = (profileId: string, snapshot: TargetDiscoverySnapshot) => {
  snapshots.set(
    profileId,
    Object.freeze({
      ...snapshot,
      selectedCategories: Object.freeze([...snapshot.selectedCategories]),
    }),
  );
  listeners.get(profileId)?.forEach((listener) => listener());
};

export const setTargetDiscoverySearchText = (
  profileId: string,
  searchText: string,
): void => {
  const current = getTargetDiscoverySnapshot(profileId);
  if (current.searchText === searchText) return;
  publish(profileId, { ...current, searchText });
};

export const toggleTargetDiscoveryCategory = (
  profileId: string,
  category: TargetCategory,
): void => {
  const current = getTargetDiscoverySnapshot(profileId);
  publish(profileId, {
    ...current,
    selectedCategories: current.selectedCategories.includes(category)
      ? current.selectedCategories.filter((item) => item !== category)
      : ALL_TARGET_CATEGORIES.filter(
          (item) =>
            item === category || current.selectedCategories.includes(item),
        ),
  });
};

export function setTargetDiscoveryFilterInput(
  profileId: string,
  field: keyof TargetFilterInputs,
  value: string,
): void {
  const current = getTargetDiscoverySnapshot(profileId);
  const filterInputs = Object.freeze({
    ...current.filterInputs,
    [field]: value,
  });
  const { limits } = resolveTargetFilterInputs(
    filterInputs,
    current.filterLimits,
  );
  const unchanged = (Object.keys(limits) as (keyof TargetFilterInputs)[]).every(
    (key) => limits[key] === current.filterLimits[key],
  );
  publish(profileId, {
    ...current,
    filterInputs,
    filterLimits: unchanged ? current.filterLimits : Object.freeze(limits),
  });
}

export function setTargetDiscoveryOrder(
  profileId: string,
  order: TargetOrder,
): void {
  const current = getTargetDiscoverySnapshot(profileId);
  if (current.order !== order) publish(profileId, { ...current, order });
}

export const useTargetDiscoveryState = (profileId: string) => {
  const subscribe = useCallback(
    (listener: () => void) =>
      subscribeToTargetDiscoveryState(profileId, listener),
    [profileId],
  );
  const getSnapshot = useCallback(
    () => getTargetDiscoverySnapshot(profileId),
    [profileId],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...snapshot,
    setFilterInput: (field: keyof TargetFilterInputs, value: string) =>
      setTargetDiscoveryFilterInput(profileId, field, value),
    setOrder: (order: TargetOrder) => setTargetDiscoveryOrder(profileId, order),
    setSearchText: (searchText: string) =>
      setTargetDiscoverySearchText(profileId, searchText),
    toggleCategory: (category: TargetCategory) =>
      toggleTargetDiscoveryCategory(profileId, category),
  };
};

export const resetTargetDiscoveryStateForTests = (): void => {
  snapshots.clear();
  listeners.clear();
};
