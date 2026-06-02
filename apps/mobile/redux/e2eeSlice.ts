import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { E2EEDeviceState, MemberPublicKeys, RoomKeyPair } from '../lib/e2ee-types';

type E2EEState = {
	deviceState: E2EEDeviceState | null;
	memberPublicKeys: {
		[roomId: string]: MemberPublicKeys;
	};
	error: string | null;
	isInitializing: boolean;
	isSyncingKeys: boolean;
};

const initialState: E2EEState = {
	deviceState: null,
	memberPublicKeys: {},
	error: null,
	isInitializing: false,
	isSyncingKeys: false,
};

const e2eeSlice = createSlice({
	name: 'e2ee',
	initialState,
	reducers: {
		setDeviceState: (state, action: PayloadAction<E2EEDeviceState>) => {
			state.deviceState = action.payload;
			state.error = null;
		},
		setInitializing: (state, action: PayloadAction<boolean>) => {
			state.isInitializing = action.payload;
		},
		setSyncingKeys: (state, action: PayloadAction<boolean>) => {
			state.isSyncingKeys = action.payload;
		},
		setRoomKeyPair: (state, action: PayloadAction<RoomKeyPair>) => {
			if (state.deviceState) {
				state.deviceState.roomKeyPairs[action.payload.roomId] = action.payload;
			}
		},
		setRoomMemberPublicKeys: (
			state,
			action: PayloadAction<{ roomId: string; memberPublicKeys: MemberPublicKeys }>
		) => {
			state.memberPublicKeys[action.payload.roomId] = action.payload.memberPublicKeys;
			state.error = null;
		},
		setError: (state, action: PayloadAction<string | null>) => {
			state.error = action.payload;
		},
		clearE2EEData: (state) => {
			state.deviceState = null;
			state.memberPublicKeys = {};
			state.error = null;
			state.isInitializing = false;
			state.isSyncingKeys = false;
		},
	},
});

export const {
	setDeviceState,
	setInitializing,
	setSyncingKeys,
	setRoomKeyPair,
	setRoomMemberPublicKeys,
	setError,
	clearE2EEData,
} = e2eeSlice.actions;

export const e2eeReducer = e2eeSlice.reducer;

export const selectDeviceState = (state: any) => state.e2ee.deviceState;
export const selectDeviceId = (state: any) => state.e2ee.deviceState?.deviceId;
export const selectE2EEError = (state: any) => state.e2ee.error;
export const selectIsInitializing = (state: any) => state.e2ee.isInitializing;
export const selectIsSyncingKeys = (state: any) => state.e2ee.isSyncingKeys;
export const selectRoomMemberPublicKeys = (roomId: string) => (state: any) =>
	state.e2ee.memberPublicKeys[roomId];
