const path = require('path');

module.exports = {
  project: {
    ios: {},
    android: {},
  },
  dependencies: {
    '@react-native-async-storage/async-storage': {
      root: path.join(__dirname, 'vendor-node_modules', '@react-native-async-storage', 'async-storage'),
    },
    '@react-native-community/datetimepicker': {
      root: path.join(__dirname, 'vendor-node_modules', '@react-native-community', 'datetimepicker'),
    },
    '@react-native-community/netinfo': {
      root: path.join(__dirname, 'vendor-node_modules', '@react-native-community', 'netinfo'),
    },
    '@react-native-google-signin/google-signin': {
      root: path.join(__dirname, 'vendor-node_modules', '@react-native-google-signin', 'google-signin'),
    },
    'react-native-get-random-values': {
      root: path.join(__dirname, 'vendor-node_modules', 'react-native-get-random-values'),
    },
    'react-native-reanimated': {
      root: path.join(__dirname, 'vendor-node_modules', 'react-native-reanimated'),
    },
    'react-native-safe-area-context': {
      root: path.join(__dirname, 'vendor-node_modules', 'react-native-safe-area-context'),
    },
    'react-native-screens': {
      root: path.join(__dirname, 'vendor-node_modules', 'react-native-screens'),
    },
    'react-native-worklets': {
      root: path.join(__dirname, 'vendor-node_modules', 'react-native-worklets'),
    },
  },
};
