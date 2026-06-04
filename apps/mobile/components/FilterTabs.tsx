import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '~/lib/themeContext';

export type FilterType = 'all' | 'groups';

interface FilterTabsProps {
	activeFilter: FilterType;
	onFilterChange: (filter: FilterType) => void;
}

export default function FilterTabs({ activeFilter, onFilterChange }: FilterTabsProps) {
	const { colors, isDark } = useTheme();

	const filters: { id: FilterType; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'groups', label: 'Groups' },
	];

	return (
		<View style={[styles.container, { borderBottomColor: colors.border }]}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
			>
				{filters.map((filter) => {
					const isActive = activeFilter === filter.id;
					return (
						<TouchableOpacity
							key={filter.id}
							style={[
								styles.tab,
								{
									backgroundColor: isActive
										? colors.primary
										: isDark
											? 'rgba(255,255,255,0.08)'
											: 'rgba(0,0,0,0.05)',
									borderColor: isActive ? colors.primary : 'transparent',
								},
							]}
							onPress={() => onFilterChange(filter.id)}
							activeOpacity={0.7}
						>
							<Text
								style={[
									styles.tabText,
									{
										color: isActive ? '#fff' : colors.text,
										fontWeight: isActive ? '600' : '400',
									},
								]}
							>
								{filter.label}
							</Text>
						</TouchableOpacity>
					);
				})}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingVertical: 12,
		borderBottomWidth: 1,
	},
	scrollContent: {
		paddingHorizontal: 16,
		gap: 8,
	},
	tab: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1,
	},
	tabText: {
		fontSize: 14,
	},
});
