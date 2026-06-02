module.exports = {
  project: {
    ios: {},
    android: {},
  },
  dependencies: {
    // Disable autolinking for packages that don't have proper Android builds
    '@react-native-async-storage/async-storage': {
      androidPackage: null,
      platforms: {
        android: null,
      },
    },
    '@react-native-community/datetimepicker': {
      androidPackage: null,
      platforms: {
        android: null,
      },
    },
    '@react-native-community/netinfo': {
      androidPackage: null,
      platforms: {
        android: null,
      },
    },
    '@react-native-google-signin/google-signin': {
      androidPackage: null,
      platforms: {
        android: null,
      },
    },
    'react-native-get-random-values': {
      androidPackage: null,
      platforms: {
        android: null,
      },
    },
    'react-native-reanimated': {
      androidPackage: null,
      platforms: {
        android: null,
      },
    },
    'react-native-safe-area-context': {
      androidPackage: null,
      platforms: {
        android: null,
      },
    },
    'react-native-screens': {
      androidPackage: null,
      platforms: {
        android: null,
      },
    },
    'react-native-worklets': {
      androidPackage: null,
      platforms: {
        android: null,
      },
    },
  },
};
