import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '~/lib/themeContext';
import { AppChip } from '~/components/ui';

export type FilterType = 'all' | 'groups';

interface FilterTabsProps {
	activeFilter: FilterType;
	onFilterChange: (filter: FilterType) => void;
}

export default function FilterTabs({ activeFilter, onFilterChange }: FilterTabsProps) {
	const { colors } = useTheme();

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
				{filters.map((filter) => (
					<AppChip
						key={filter.id}
						active={activeFilter === filter.id}
						onPress={() => onFilterChange(filter.id)}
					>
						{filter.label}
					</AppChip>
				))}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingVertical: 12,
		borderBottomWidth: 2,
	},
	scrollContent: {
		paddingHorizontal: 16,
		gap: 8,
	},
});
