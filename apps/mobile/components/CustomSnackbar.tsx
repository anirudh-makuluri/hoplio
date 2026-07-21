import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal, Snackbar, Text } from 'react-native-paper';
import { useTheme } from '~/lib/themeContext';

export default function CustomSnackbar({
	snackbarMsg,
	setSnackbarMsg,
}: {
	snackbarMsg: string;
	setSnackbarMsg: React.Dispatch<React.SetStateAction<string>>;
}) {
	const { colors } = useTheme();

	return (
		<Portal>
			<Snackbar
				visible={snackbarMsg.length > 0}
				duration={5000}
				onDismiss={() => setSnackbarMsg('')}
				wrapperStyle={styles.wrapper}
				style={[styles.snackbar, { backgroundColor: colors.surfaceElevated }]}
			>
				<Text style={{ color: colors.text }}>{snackbarMsg}</Text>
			</Snackbar>
		</Portal>
	);
}

const styles = StyleSheet.create({
	wrapper: {
		left: 0,
		right: 0,
		bottom: 0,
		width: '100%',
	},
	snackbar: {
		width: '100%',
		maxWidth: '100%',
		marginHorizontal: 0,
		marginBottom: 0,
		borderRadius: 0,
	},
});
