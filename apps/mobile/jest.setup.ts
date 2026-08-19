import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => {
  const reactNative = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View: reactNative.View },
    runOnJS: (callback: (...parameters: unknown[]) => unknown) => callback,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (value: unknown) => ({ value }),
  };
});
