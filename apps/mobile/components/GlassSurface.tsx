import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '~/lib/themeContext';

type Props = {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	/** @deprecated ignored — solid surfaces replace blur */
	intensity?: number;
	rounded?: number;
	border?: boolean;
};

/**
 * Solid surface replacement for the old blur glass look.
 * Kept for API compatibility; prefer AppCard for new UI.
 */
export default function GlassSurface({
	children,
	style,
	rounded = 18,
	border = true,
}: Props) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.surface,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: rounded,
					borderWidth: border ? 2 : 0,
				},
				style,
			]}
		>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	surface: {
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
		elevation: 2,
	},
});
