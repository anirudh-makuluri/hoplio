import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True when running inside the stock Expo Go app (not a custom dev build). */
export function isExpoGo(): boolean {
	return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Google Sign-In requires native code from a custom dev client. */
export function supportsGoogleSignIn(): boolean {
	return Platform.OS !== 'web' && !isExpoGo();
}

/** Remote push registration was removed from Expo Go in SDK 53+. */
export function supportsRemotePushNotifications(): boolean {
	return Platform.OS !== 'web' && !isExpoGo();
}
