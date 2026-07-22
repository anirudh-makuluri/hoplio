import { initializeApp, getApps, type FirebaseApp } from '@firebase/app';
import { getAuth, type Auth } from '@firebase/auth';
import { config } from '~/lib/config';

function initFirebase(): { app: FirebaseApp; auth: Auth } {
	const app =
		getApps().length === 0
			? initializeApp(config.firebaseConfig)
			: (getApps()[0] as FirebaseApp);

	return { app, auth: getAuth(app) };
}

const { app, auth } = initFirebase();

export { app, auth };
