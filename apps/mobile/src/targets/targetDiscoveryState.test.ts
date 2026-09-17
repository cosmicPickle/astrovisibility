import {
  DEFAULT_TARGET_FILTER_INPUTS,
  DEFAULT_TARGET_FILTER_LIMITS,
} from './advancedTargetFilters';
import {
  getTargetDiscoverySnapshot,
  resetTargetDiscoveryStateForTests,
  setTargetDiscoverySearchText,
  subscribeToTargetDiscoveryState,
  toggleTargetDiscoveryCategory,
} from './targetDiscoveryState';

describe('profile-scoped target discovery state', () => {
  beforeEach(resetTargetDiscoveryStateForTests);

  it('shares search and category changes for one profile without leaking to another', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToTargetDiscoveryState('profile-1', listener);

    setTargetDiscoverySearchText('profile-1', 'Andromeda');
    toggleTargetDiscoveryCategory('profile-1', 'galaxies');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(getTargetDiscoverySnapshot('profile-1')).toEqual({
      filterInputs: DEFAULT_TARGET_FILTER_INPUTS,
      filterLimits: DEFAULT_TARGET_FILTER_LIMITS,
      order: 'longestVisible',
      searchText: 'Andromeda',
      selectedCategories: ['nebulae', 'starClusters'],
    });
    expect(getTargetDiscoverySnapshot('profile-2')).toEqual({
      filterInputs: DEFAULT_TARGET_FILTER_INPUTS,
      filterLimits: DEFAULT_TARGET_FILTER_LIMITS,
      order: 'longestVisible',
      searchText: '',
      selectedCategories: ['galaxies', 'nebulae', 'starClusters'],
    });
    unsubscribe();
  });
});
