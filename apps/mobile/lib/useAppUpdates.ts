import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Checks for EAS Update OTA bundles in release builds.
 * Downloads available updates in the background and reloads once ready.
 * No-ops in development / Expo Go where expo-updates is disabled.
 */
export function useAppUpdates() {
	const appState = useRef(AppState.currentState);
	const checking = useRef(false);

	const checkAndApplyUpdate = useCallback(async () => {
		if (__DEV__ || !Updates.isEnabled || checking.current) {
			return;
		}

		checking.current = true;
		try {
			const result = await Updates.checkForUpdateAsync();
			if (!result.isAvailable) {
				return;
			}

			const fetchResult = await Updates.fetchUpdateAsync();
			if (fetchResult.isNew) {
				await Updates.reloadAsync();
			}
		} catch {
			// Network / server failures should not interrupt app use.
		} finally {
			checking.current = false;
		}
	}, []);

	useEffect(() => {
		void checkAndApplyUpdate();

		const onAppStateChange = (nextState: AppStateStatus) => {
			if (
				appState.current.match(/inactive|background/) &&
				nextState === 'active'
			) {
				void checkAndApplyUpdate();
			}
			appState.current = nextState;
		};

		const subscription = AppState.addEventListener('change', onAppStateChange);
		return () => subscription.remove();
	}, [checkAndApplyUpdate]);
}
