import { initializeApp, getApps, type FirebaseApp } from '@firebase/app';
import {
	initializeAuth,
	getAuth,
	type Auth,
	getReactNativePersistence,
} from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '~/lib/config';

const authPersistence = {
	persistence: getReactNativePersistence(AsyncStorage),
};

function initFirebase(): { app: FirebaseApp; auth: Auth } {
	if (getApps().length === 0) {
		const app = initializeApp(config.firebaseConfig);
		const auth = initializeAuth(app, authPersistence);
		return { app, auth };
	}

	const app = getApps()[0] as FirebaseApp;

	try {
		return { app, auth: getAuth(app) };
	} catch {
		return { app, auth: initializeAuth(app, authPersistence) };
	}
}

const { app, auth } = initFirebase();

export { app, auth };
