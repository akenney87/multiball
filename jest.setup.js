// Jest setup file for additional configuration
// Add any global test setup here

// Mock AsyncStorage for React Native tests
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
