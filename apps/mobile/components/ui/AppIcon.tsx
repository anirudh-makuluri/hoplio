import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { IconWeight } from 'phosphor-react-native';
import { Question } from 'phosphor-react-native';
import { iconRegistry, resolveIconWeight } from '~/lib/iconRegistry';

type Props = {
	name: string;
	size?: number;
	color?: string;
	weight?: IconWeight;
	style?: StyleProp<ViewStyle>;
};

export default function AppIcon({ name, size = 24, color, weight, style }: Props) {
	const entry = iconRegistry[name];

	if (!entry) {
		if (__DEV__) {
			console.warn(`[AppIcon] Unknown icon: "${name}"`);
		}

		return <Question size={size} color={color} weight="regular" style={style} />;
	}

	const { Icon } = entry;

	return (
		<Icon
			size={size}
			color={color}
			weight={resolveIconWeight(name, weight ?? entry.weight)}
			style={style}
		/>
	);
}
