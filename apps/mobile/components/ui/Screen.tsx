import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '~/lib/themeContext';

type Props = {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	edges?: Edge[];
	padded?: boolean;
};

export default function Screen({
	children,
	style,
	edges = ['top', 'left', 'right'],
	padded = false,
}: Props) {
	const { colors } = useTheme();

	return (
		<SafeAreaView
			style={[styles.root, { backgroundColor: colors.background }, style]}
			edges={edges}
		>
			<View style={[styles.inner, padded && styles.padded]}>{children}</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	inner: {
		flex: 1,
	},
	padded: {
		paddingHorizontal: 16,
	},
});
