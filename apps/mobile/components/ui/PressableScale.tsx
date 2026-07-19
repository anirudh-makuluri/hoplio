import React, { ReactNode } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from 'react-native-reanimated';
import { hapticLight, hapticMedium, hapticSelection } from '~/lib/haptics';

type HapticKind = 'none' | 'light' | 'medium' | 'selection';

type Props = {
	children: ReactNode;
	onPress?: () => void;
	onLongPress?: () => void;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
	haptic?: HapticKind;
	scaleTo?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PressableScale({
	children,
	onPress,
	onLongPress,
	disabled,
	style,
	haptic = 'light',
	scaleTo = 0.97,
}: Props) {
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	const fireHaptic = () => {
		if (haptic === 'light') void hapticLight();
		else if (haptic === 'medium') void hapticMedium();
		else if (haptic === 'selection') void hapticSelection();
	};

	return (
		<AnimatedPressable
			disabled={disabled}
			onPressIn={() => {
				scale.value = withSpring(scaleTo, { damping: 15, stiffness: 400 });
			}}
			onPressOut={() => {
				scale.value = withSpring(1, { damping: 12, stiffness: 300 });
			}}
			onPress={() => {
				if (disabled) return;
				fireHaptic();
				onPress?.();
			}}
			onLongPress={onLongPress}
			style={[animatedStyle, style]}
		>
			{children}
		</AnimatedPressable>
	);
}
