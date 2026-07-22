import { AppThunk } from './store';
import { setOfflineMode } from './chatSlice';
import { setSyncError, setSyncing, setSyncSuccess } from './syncSlice';
import { joinChatRoomWithCache } from './chatThunks';
import { customFetch } from '../lib/utils';
import { offlineStorage } from '../lib/offlineStorage';
import { flushPendingMessages } from '../lib/syncService';
import { TAuthUser } from '../lib/types';

type BackgroundSyncOptions = {
	onUserUpdated?: (user: TAuthUser) => void;
};

const MIN_SYNC_INTERVAL_MS = 10_000;
let activeSyncPromise: Promise<void> | null = null;
let lastSyncFinishedAt = 0;

export const runBackgroundSync = (options: BackgroundSyncOptions = {}): AppThunk => (dispatch, getState) => {
	if (!offlineStorage.isNetworkOnline()) {
		return Promise.resolve();
	}

	const elapsed = Date.now() - lastSyncFinishedAt;
	if (activeSyncPromise) {
		return activeSyncPromise;
	}
	if (lastSyncFinishedAt > 0 && elapsed < MIN_SYNC_INTERVAL_MS) {
		return Promise.resolve();
	}

	activeSyncPromise = (async () => {
		if (getState().sync.isSyncing) {
			return;
		}

		dispatch(setSyncing(true));

		let hadPartialSuccess = false;

		try {
			const { socket } = getState().socket;
			const pendingResult = await flushPendingMessages(socket);
			if (pendingResult.sent > 0) {
				hadPartialSuccess = true;
			}
			if (pendingResult.sent > 0 || pendingResult.failed > 0 || pendingResult.skipped > 0) {
				console.log('Pending message sync:', pendingResult);
			}

			try {
				const data = await customFetch({ pathName: 'session' });
				if (data.success && data.user) {
					const rooms = Array.isArray(data.user.rooms) ? data.user.rooms : [];

					for (const room of rooms) {
						await dispatch(joinChatRoomWithCache(room));
					}

					await offlineStorage.saveUserData(data.user);
					await offlineStorage.setOfflineMode(false);
					dispatch(setOfflineMode(false));
					options.onUserUpdated?.(data.user);
					hadPartialSuccess = true;
				}
			} catch (sessionError) {
				const message = sessionError instanceof Error ? sessionError.message : 'Session refresh failed';
				console.warn('Session pull failed during background sync:', sessionError);
				dispatch(setSyncError(message));
			}

			if (hadPartialSuccess) {
				await offlineStorage.updateLastSyncTime();
				dispatch(setSyncSuccess());
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Background sync failed';
			console.warn('Background sync failed:', error);
			dispatch(setSyncError(message));
		} finally {
			dispatch(setSyncing(false));
			lastSyncFinishedAt = Date.now();
			activeSyncPromise = null;
		}
	})();

	return activeSyncPromise;
};
