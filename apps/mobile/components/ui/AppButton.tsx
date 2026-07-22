import React, { ReactNode, useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	StyleProp,
	StyleSheet,
	Text,
	View,
	ViewStyle,
} from 'react-native';
import AppIcon from './AppIcon';
import { LIP_HEIGHT, useTheme } from '~/lib/themeContext';
import { hapticError, hapticMedium, hapticSuccess } from '~/lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'accent';

type Props = {
	children: ReactNode;
	onPress?: () => void;
	disabled?: boolean;
	loading?: boolean;
	variant?: Variant;
	icon?: string;
	style?: StyleProp<ViewStyle>;
	fullWidth?: boolean;
	hapticOnSuccess?: boolean;
	compact?: boolean;
};

export default function AppButton({
	children,
	onPress,
	disabled,
	loading,
	variant = 'primary',
	icon,
	style,
	fullWidth,
	hapticOnSuccess,
	compact,
}: Props) {
	const { colors, radii } = useTheme();
	const [pressed, setPressed] = useState(false);
	const isDisabled = disabled || loading;

	const palette = (() => {
		switch (variant) {
			case 'secondary':
				return {
					face: colors.surface,
					lip: colors.border,
					text: colors.text,
					border: colors.border,
				};
			case 'ghost':
				return {
					face: 'transparent',
					lip: 'transparent',
					text: colors.primary,
					border: 'transparent',
				};
			case 'destructive':
				return {
					face: colors.destructive,
					lip: '#D93636',
					text: colors.destructiveForeground,
					border: colors.destructive,
				};
			case 'accent':
				return {
					face: colors.accent,
					lip: '#E0B000',
					text: colors.accentForeground,
					border: colors.accent,
				};
			default:
				return {
					face: colors.primary,
					lip: colors.primaryDark,
					text: colors.primaryForeground,
					border: colors.primary,
				};
		}
	})();

	const showLip = variant !== 'ghost' && !isDisabled;

	const handlePress = () => {
		if (isDisabled) return;
		if (variant === 'destructive') {
			void hapticError();
		} else if (hapticOnSuccess) {
			void hapticSuccess();
		} else {
			void hapticMedium();
		}
		onPress?.();
	};

	return (
		<View
			style={[
				styles.outer,
				fullWidth && styles.fullWidth,
				{ opacity: isDisabled ? 0.55 : 1 },
				style,
			]}
		>
			{showLip && (
				<View
					style={[
						styles.lip,
						{
							backgroundColor: palette.lip,
							borderRadius: radii.button,
							height: LIP_HEIGHT + (compact ? 40 : 48),
						},
					]}
				/>
			)}
			<Pressable
				disabled={isDisabled}
				onPressIn={() => setPressed(true)}
				onPressOut={() => setPressed(false)}
				onPress={handlePress}
				style={[
					styles.face,
					{
						backgroundColor: palette.face,
						borderColor: palette.border,
						borderRadius: radii.button,
						borderWidth: variant === 'secondary' ? 2 : variant === 'ghost' ? 0 : 0,
						transform: [{ translateY: pressed && showLip ? LIP_HEIGHT : 0 }],
						minHeight: compact ? 40 : 48,
						paddingHorizontal: compact ? 14 : 20,
					},
				]}
			>
				{loading ? (
					<ActivityIndicator color={palette.text} />
				) : (
					<View style={styles.content}>
						{icon ? <AppIcon name={icon} size={compact ? 18 : 20} color={palette.text} /> : null}
						<Text
							style={[
								styles.label,
								{
									color: palette.text,
									fontSize: compact ? 14 : 16,
								},
							]}
						>
							{children}
						</Text>
					</View>
				)}
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	outer: {
		position: 'relative',
		alignSelf: 'flex-start',
	},
	fullWidth: {
		alignSelf: 'stretch',
	},
	lip: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: LIP_HEIGHT,
	},
	face: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	label: {
		fontWeight: '800',
		letterSpacing: 0.2,
	},
});
