import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type SyncState = {
	isSyncing: boolean;
	lastSyncedAt: number | null;
	lastError: string | null;
};

const initialState: SyncState = {
	isSyncing: false,
	lastSyncedAt: null,
	lastError: null,
};

const syncSlice = createSlice({
	name: 'sync',
	initialState,
	reducers: {
		setSyncing: (state, action: PayloadAction<boolean>) => {
			state.isSyncing = action.payload;
			if (action.payload) {
				state.lastError = null;
			}
		},
		setSyncSuccess: (state) => {
			state.lastSyncedAt = Date.now();
			state.lastError = null;
		},
		setSyncError: (state, action: PayloadAction<string>) => {
			state.lastError = action.payload;
		},
	},
});

export const { setSyncing, setSyncSuccess, setSyncError } = syncSlice.actions;
export const syncReducer = syncSlice.reducer;

export const selectIsSyncing = (state: { sync: SyncState }) => state.sync.isSyncing;
export const selectLastSyncedAt = (state: { sync: SyncState }) => state.sync.lastSyncedAt;
export const selectSyncError = (state: { sync: SyncState }) => state.sync.lastError;
