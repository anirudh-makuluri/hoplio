import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '~/lib/themeContext';

type BrandScreenProps = {
	children: ReactNode;
	contentStyle?: ViewStyle;
};

/** Clean playful entry background — no mesh/glow vibecode */
export default function BrandScreen({ children, contentStyle }: BrandScreenProps) {
	const { colors, isDark } = useTheme();

	return (
		<View style={[styles.container, { backgroundColor: isDark ? colors.background : '#E8F9D8' }]}>
			<View
				style={[
					styles.blob,
					styles.blobTop,
					{ backgroundColor: isDark ? 'rgba(88, 204, 2, 0.12)' : 'rgba(88, 204, 2, 0.22)' },
				]}
			/>
			<View
				style={[
					styles.blob,
					styles.blobBottom,
					{ backgroundColor: isDark ? 'rgba(255, 200, 0, 0.08)' : 'rgba(255, 200, 0, 0.18)' },
				]}
			/>
			<View style={[styles.content, contentStyle]}>{children}</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: 24,
	},
	blob: {
		position: 'absolute',
		borderRadius: 999,
	},
	blobTop: {
		top: -60,
		right: -40,
		width: 220,
		height: 220,
	},
	blobBottom: {
		bottom: -80,
		left: -50,
		width: 260,
		height: 260,
	},
});
