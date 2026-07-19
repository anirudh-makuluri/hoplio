import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '~/lib/themeContext';
import PressableScale from './PressableScale';

type Props = {
	children: ReactNode;
	active?: boolean;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
	tone?: 'primary' | 'ai' | 'accent' | 'neutral';
};

export default function AppChip({
	children,
	active = false,
	onPress,
	style,
	tone = 'primary',
}: Props) {
	const { colors, radii, isDark } = useTheme();

	const activeBg =
		tone === 'ai' ? colors.ai : tone === 'accent' ? colors.accent : colors.primary;
	const activeText =
		tone === 'accent' ? colors.accentForeground : colors.primaryForeground;

	return (
		<PressableScale
			onPress={onPress}
			haptic="selection"
			scaleTo={0.96}
			style={[
				styles.chip,
				{
					backgroundColor: active
						? activeBg
						: isDark
							? 'rgba(255,255,255,0.08)'
							: colors.muted,
					borderColor: active ? activeBg : colors.border,
					borderRadius: radii.full,
				},
				style,
			]}
		>
			<Text
				style={[
					styles.label,
					{
						color: active ? activeText : colors.text,
						fontWeight: active ? '800' : '600',
					},
				]}
			>
				{children}
			</Text>
		</PressableScale>
	);
}

const styles = StyleSheet.create({
	chip: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderWidth: 2,
	},
	label: {
		fontSize: 14,
	},
});
