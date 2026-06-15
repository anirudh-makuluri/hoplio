const path = require('path');

const nativeVendorRoot =
  process.env.HOPLIO_NATIVE_VENDOR_ROOT ||
  (process.platform === 'win32'
    ? path.join(process.env.SystemDrive || 'C:', 'hoplio-native')
    : path.join('/tmp', 'hoplio-native'));

module.exports = {
  project: {
    ios: {},
    android: {},
  },
  dependencies: {
    '@react-native-async-storage/async-storage': {
      root: path.join(nativeVendorRoot, '@react-native-async-storage', 'async-storage'),
    },
    '@react-native-community/datetimepicker': {
      root: path.join(nativeVendorRoot, '@react-native-community', 'datetimepicker'),
    },
    '@react-native-community/netinfo': {
      root: path.join(nativeVendorRoot, '@react-native-community', 'netinfo'),
    },
    '@react-native-google-signin/google-signin': {
      root: path.join(nativeVendorRoot, '@react-native-google-signin', 'google-signin'),
    },
    'react-native-get-random-values': {
      root: path.join(nativeVendorRoot, 'react-native-get-random-values'),
    },
    'react-native-reanimated': {
      root: path.join(nativeVendorRoot, 'react-native-reanimated'),
    },
    'react-native-safe-area-context': {
      root: path.join(nativeVendorRoot, 'react-native-safe-area-context'),
    },
    'react-native-screens': {
      root: path.join(nativeVendorRoot, 'react-native-screens'),
    },
    'react-native-worklets': {
      root: path.join(nativeVendorRoot, 'react-native-worklets'),
    },
  },
};
