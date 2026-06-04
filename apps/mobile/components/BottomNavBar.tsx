import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Icon, Badge } from 'react-native-paper';
import { useTheme } from '~/lib/themeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassSurface from '~/components/GlassSurface';

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
		{ id: 'updates', label: 'Friends', icon: 'account-multiple-outline', activeIcon: 'account-multiple', badge: pendingRequests },
		{ id: 'profile', label: 'Profile', icon: 'account-outline', activeIcon: 'account' },
	];

	return (
		<View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
			<GlassSurface intensity={26} rounded={24} style={[styles.glass, { borderColor: colors.border }]}>
				<View style={styles.container}>
					{tabs.map((tab) => {
						const isActive = activeTab === tab.id;
						return (
							<TouchableOpacity
								key={tab.id}
								style={styles.tab}
								onPress={() => onTabChange(tab.id)}
								activeOpacity={0.7}
							>
								<View style={styles.iconContainer}>
									<Icon
										source={isActive ? tab.activeIcon : tab.icon}
										size={26}
										color={isActive ? colors.primary : colors.textSecondary}
									/>
									{tab.badge && tab.badge > 0 ? (
										<Badge
											size={18}
											style={[
												styles.badge,
												{ backgroundColor: colors.primary },
											]}
										>
											{tab.badge > 99 ? '99+' : tab.badge}
										</Badge>
									) : null}
								</View>
								<Text
									style={[
										styles.label,
										{
											color: isActive ? colors.primary : colors.textSecondary,
											fontWeight: isActive ? '600' : '400',
										},
									]}
								>
									{tab.label}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</GlassSurface>
		</View>
	);
}

const styles = StyleSheet.create({
	outer: {
		paddingHorizontal: 12,
		paddingTop: 8,
	},
	glass: {
		borderWidth: 1,
	},
	container: {
		flexDirection: 'row',
		paddingTop: 10,
		paddingBottom: 10,
	},
	tab: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 4,
	},
	iconContainer: {
		position: 'relative',
		marginBottom: 2,
	},
	badge: {
		position: 'absolute',
		top: -6,
		right: -10,
	},
	label: {
		fontSize: 11,
		marginTop: 2,
	},
});
