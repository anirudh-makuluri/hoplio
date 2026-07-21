import { View, StyleSheet } from 'react-native';
import { Text, Badge } from 'react-native-paper';
import AppIcon from '~/components/ui/AppIcon';
import { useTheme } from '~/lib/themeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '~/components/ui/PressableScale';
import { hapticSelection } from '~/lib/haptics';

type TabType = 'chats' | 'updates' | 'profile';

interface BottomNavBarProps {
	activeTab: TabType;
	onTabChange: (tab: TabType) => void;
	unreadCount?: number;
	pendingRequests?: number;
}

export default function BottomNavBar({
	activeTab,
	onTabChange,
	unreadCount = 0,
	pendingRequests = 0,
}: BottomNavBarProps) {
	const { colors, isDark } = useTheme();
	const insets = useSafeAreaInsets();

	const tabs: { id: TabType; label: string; icon: string; activeIcon: string; badge?: number }[] = [
		{ id: 'chats', label: 'Chats', icon: 'chat-outline', activeIcon: 'chat', badge: unreadCount },
		{
			id: 'updates',
			label: 'Friends',
			icon: 'account-multiple-outline',
			activeIcon: 'account-multiple',
			badge: pendingRequests,
		},
		{ id: 'profile', label: 'Profile', icon: 'account-outline', activeIcon: 'account' },
	];

	return (
		<View
			style={[
				styles.outer,
				{
					paddingBottom: Math.max(insets.bottom, 10),
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
				},
			]}
		>
			<View style={styles.container}>
				{tabs.map((tab) => {
					const isActive = activeTab === tab.id;
					return (
						<PressableScale
							key={tab.id}
							style={styles.tab}
							haptic="none"
							scaleTo={0.94}
							onPress={() => {
								void hapticSelection();
								onTabChange(tab.id);
							}}
						>
							<View
								style={[
									styles.iconPill,
									isActive && {
										backgroundColor: isDark ? 'rgba(88, 204, 2, 0.18)' : '#D7FFB8',
									},
								]}
							>
								<AppIcon
									name={isActive ? tab.activeIcon : tab.icon}
									size={24}
									color={isActive ? colors.primaryDark : colors.textSecondary}
								/>
								{tab.badge && tab.badge > 0 ? (
									<Badge size={18} style={[styles.badge, { backgroundColor: colors.destructive }]}>
										{tab.badge > 99 ? '99+' : tab.badge}
									</Badge>
								) : null}
							</View>
							<Text
								style={[
									styles.label,
									{
										color: isActive ? colors.primaryDark : colors.textSecondary,
										fontWeight: isActive ? '800' : '600',
									},
								]}
							>
								{tab.label}
							</Text>
						</PressableScale>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	outer: {
		paddingTop: 8,
		borderTopWidth: 2,
	},
	container: {
		flexDirection: 'row',
		paddingHorizontal: 8,
	},
	tab: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 4,
	},
	iconPill: {
		position: 'relative',
		paddingHorizontal: 16,
		paddingVertical: 6,
		borderRadius: 16,
		marginBottom: 2,
	},
	badge: {
		position: 'absolute',
		top: -4,
		right: -2,
	},
	label: {
		fontSize: 11,
		marginTop: 2,
	},
});
