import { useEffect } from 'react';
import { Platform, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';

/** Always use a dark status bar with light icons, independent of app theme. */
export const STATUS_BAR_BG = '#131F24';

export default function AppStatusBar() {
	const insets = useSafeAreaInsets();

	useEffect(() => {
		void SystemUI.setBackgroundColorAsync(STATUS_BAR_BG);
	}, []);

	return (
		<>
			<StatusBar
				barStyle="light-content"
				backgroundColor={STATUS_BAR_BG}
				translucent={Platform.OS === 'android'}
			/>
			<View
				pointerEvents="none"
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					height: insets.top,
					backgroundColor: STATUS_BAR_BG,
					zIndex: 1000,
				}}
			/>
		</>
	);
}
