const transformedModules = [
  '@gluestack-ui',
  '@expo',
  '@react-navigation',
  '@react-native',
  'expo',
  'expo-.*',
  'nativewind',
  'react-native',
  'react-native-css',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-svg',
  'react-native-worklets',
].join('|');

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '<rootDir>/app/**/*.test.ts?(x)',
    '<rootDir>/scripts/**/*.test.ts?(x)',
    '<rootDir>/src/**/*.test.ts?(x)',
  ],
  transformIgnorePatterns: [
    `/node_modules/(?!(${transformedModules}|\\.pnpm))`,
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
