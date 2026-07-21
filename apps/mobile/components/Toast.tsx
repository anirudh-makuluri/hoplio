import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import AppIcon from '~/components/ui/AppIcon';
import { useTheme } from '~/lib/themeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'info' | 'success' | 'error' | 'coming-soon';

interface ToastOptions {
	message: string;
	type?: ToastType;
	duration?: number;
}

interface ToastContextType {
	showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType>({
	showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const { colors, isDark } = useTheme();
	const insets = useSafeAreaInsets();
	const [toast, setToast] = useState<ToastOptions | null>(null);
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const slideAnim = useRef(new Animated.Value(-100)).current;

	const showToast = useCallback((options: ToastOptions) => {
		setToast(options);
	}, []);

	useEffect(() => {
		if (toast) {
			// Animate in
			Animated.parallel([
				Animated.timing(fadeAnim, {
					toValue: 1,
					duration: 300,
					useNativeDriver: true,
				}),
				Animated.spring(slideAnim, {
					toValue: 0,
					friction: 8,
					tension: 40,
					useNativeDriver: true,
				}),
			]).start();

			// Auto dismiss
			const timeout = setTimeout(() => {
				Animated.parallel([
					Animated.timing(fadeAnim, {
						toValue: 0,
						duration: 200,
						useNativeDriver: true,
					}),
					Animated.timing(slideAnim, {
						toValue: -100,
						duration: 200,
						useNativeDriver: true,
					}),
				]).start(() => {
					setToast(null);
				});
			}, toast.duration || 2500);

			return () => clearTimeout(timeout);
		}
	}, [toast]);

	const getIcon = (type: ToastType) => {
		switch (type) {
			case 'success':
				return 'check-circle';
			case 'error':
				return 'alert-circle';
			case 'coming-soon':
				return 'clock-outline';
			default:
				return 'information';
		}
	};

	const getColors = (type: ToastType) => {
		switch (type) {
			case 'success':
				return { bg: colors.success, icon: '#fff', text: '#fff' };
			case 'error':
				return { bg: colors.destructive, icon: '#fff', text: '#fff' };
			case 'coming-soon':
				return { bg: colors.accent, icon: colors.accentForeground, text: colors.accentForeground };
			default:
				return {
					bg: isDark ? colors.surfaceElevated : colors.text,
					icon: isDark ? colors.text : '#fff',
					text: isDark ? colors.text : '#fff',
				};
		}
	};

	const toastColors = toast ? getColors(toast.type || 'info') : null;

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			{toast && toastColors && (
				<Animated.View
					style={[
						styles.toastContainer,
						{
							top: insets.top + 10,
							opacity: fadeAnim,
							transform: [{ translateY: slideAnim }],
						},
					]}
				>
					<View
						style={[
							styles.toast,
							{
								backgroundColor: toastColors.bg,
							},
						]}
					>
						<AppIcon
							name={getIcon(toast.type || 'info')}
							size={22}
							color={toastColors.icon}
						/>
						<Text style={[styles.toastText, { color: toastColors.text }]}>
							{toast.message}
						</Text>
					</View>
				</Animated.View>
			)}
		</ToastContext.Provider>
	);
}

const styles = StyleSheet.create({
	toastContainer: {
		position: 'absolute',
		left: 16,
		right: 16,
		zIndex: 9999,
		alignItems: 'center',
	},
	toast: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderRadius: 16,
		gap: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 8,
	},
	toastText: {
		fontSize: 15,
		fontWeight: '700',
		flex: 1,
	},
});
