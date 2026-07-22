import type { ComponentType, ReactNode } from 'react';
import { View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import { supportsKeyboardController } from './runtime';

type KeyboardStickyViewProps = ViewProps & {
	offset?: { closed: number; opened: number };
	onLayout?: (event: LayoutChangeEvent) => void;
};

function PassthroughProvider({ children }: { children: ReactNode }) {
	return <>{children}</>;
}

function PassthroughStickyView({ children, style, onLayout }: KeyboardStickyViewProps) {
	return (
		<View style={style} onLayout={onLayout}>
			{children}
		</View>
	);
}

let KeyboardProvider: ComponentType<{ children: ReactNode }> = PassthroughProvider;
let KeyboardStickyView: ComponentType<KeyboardStickyViewProps> = PassthroughStickyView;

if (supportsKeyboardController()) {
	try {
		const keyboardController = require('react-native-keyboard-controller') as {
			KeyboardProvider: ComponentType<{ children: ReactNode }>;
			KeyboardStickyView: ComponentType<KeyboardStickyViewProps>;
		};
		KeyboardProvider = keyboardController.KeyboardProvider;
		KeyboardStickyView = keyboardController.KeyboardStickyView;
	} catch (error) {
		console.warn('react-native-keyboard-controller is unavailable; using fallbacks.', error);
	}
}

export { KeyboardProvider, KeyboardStickyView };
