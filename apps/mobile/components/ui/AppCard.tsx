import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '~/lib/themeContext';

type Props = {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	padded?: boolean;
	elevated?: boolean;
};

export default function AppCard({ children, style, padded = true, elevated = true }: Props) {
	const { colors, radii, isDark } = useTheme();

	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: radii.card,
					shadowOpacity: elevated && !isDark ? 0.08 : 0,
					elevation: elevated ? 2 : 0,
				},
				padded && styles.padded,
				style,
			]}
		>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowRadius: 6,
	},
	padded: {
		padding: 16,
	},
});
