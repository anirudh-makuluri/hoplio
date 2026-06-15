import React, { ReactNode } from 'react';
import { DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';

type BrandScreenProps = {
	children: ReactNode;
	contentStyle?: ViewStyle;
};

export default function BrandScreen({ children, contentStyle }: BrandScreenProps) {
	return (
		<View style={styles.container}>
			<View style={[styles.glow, styles.cyanGlow]} />
			<View style={[styles.glow, styles.blueGlow]} />
			<View style={[styles.glow, styles.indigoGlow]} />
			<View style={styles.meshWrap}>
				{MESH_POINTS.map((point, index) => (
					<View
						key={`${point.top}-${point.left}-${index}`}
						style={[
							styles.meshPoint,
							{
								top: point.top,
								left: point.left,
								opacity: point.opacity,
								transform: [{ scale: point.scale }],
							},
						]}
					/>
				))}
			</View>
			<View style={[styles.content, contentStyle]}>{children}</View>
		</View>
	);
}

const MESH_POINTS: { top: DimensionValue; left: DimensionValue; opacity: number; scale: number }[] = [
	{ top: '10%', left: '16%', opacity: 0.22, scale: 1 },
	{ top: '16%', left: '42%', opacity: 0.18, scale: 0.9 },
	{ top: '12%', left: '74%', opacity: 0.16, scale: 1.1 },
	{ top: '28%', left: '22%', opacity: 0.24, scale: 1.1 },
	{ top: '34%', left: '56%', opacity: 0.16, scale: 0.85 },
	{ top: '31%', left: '84%', opacity: 0.18, scale: 1.05 },
	{ top: '52%', left: '12%', opacity: 0.15, scale: 0.85 },
	{ top: '56%', left: '36%', opacity: 0.22, scale: 1 },
	{ top: '60%', left: '68%', opacity: 0.18, scale: 1.15 },
	{ top: '74%', left: '24%', opacity: 0.16, scale: 1.05 },
	{ top: '78%', left: '52%', opacity: 0.22, scale: 0.9 },
	{ top: '70%', left: '82%', opacity: 0.16, scale: 1 },
];

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#020617',
	},
	content: {
		flex: 1,
		paddingHorizontal: 24,
	},
	glow: {
		position: 'absolute',
		borderRadius: 999,
	},
	cyanGlow: {
		top: -80,
		left: -40,
		width: 220,
		height: 220,
		backgroundColor: 'rgba(34, 211, 238, 0.16)',
	},
	blueGlow: {
		top: '22%',
		right: -70,
		width: 240,
		height: 240,
		backgroundColor: 'rgba(59, 130, 246, 0.14)',
	},
	indigoGlow: {
		bottom: -110,
		left: '15%',
		width: 280,
		height: 280,
		backgroundColor: 'rgba(99, 102, 241, 0.12)',
	},
	meshWrap: {
		...StyleSheet.absoluteFillObject,
	},
	meshPoint: {
		position: 'absolute',
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#22d3ee',
	},
});
