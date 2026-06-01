import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Avatar, Button, Snackbar, Text } from 'react-native-paper';
import { useUser } from '~/app/providers';
import { TUser } from '~/lib/types';
import { getErrorMessage } from '~/lib/utils';
import { useAppSelector } from '~/redux/store';
import { useTheme } from '~/lib/themeContext';

export default function FetchedUser({
	fetchedUser,
	closeModal,
}: {
	fetchedUser: TUser;
	closeModal: () => void;
}) {
	const { user } = useUser();
	const { colors } = useTheme();
	const socket = useAppSelector((state) => state.socket.socket);
	const [snackbarMsg, setSnackbarMsg] = useState('');

	function handleAddFriend() {
		if (!user || !socket) return;
		socket.emit(
			'send_friend_request_client_to_server',
			{ receiverUid: fetchedUser.uid },
			(res: any) => {
				setSnackbarMsg(res.success || getErrorMessage(res?.error, 'Unable to send friend request'));
				closeModal();
			}
		);
	}

	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
				},
			]}
		>
			<View style={styles.row}>
				<View style={styles.left}>
					<Avatar.Image
						size={48}
						source={{ uri: fetchedUser.photo_url }}
						style={{ borderWidth: 2, borderColor: colors.border }}
					/>
					<View style={styles.info}>
						<Text style={[styles.name, { color: colors.text }]}>{fetchedUser.name}</Text>
						<Text style={[styles.email, { color: colors.textSecondary }]}>
							{fetchedUser.email}
						</Text>
						<View style={styles.badgeRow}>
							<View
								style={[
									styles.dot,
									{ backgroundColor: colors.primary },
								]}
							/>
							<Text style={[styles.badgeText, { color: colors.primary }]}>
								Available to add
							</Text>
						</View>
					</View>
				</View>
				<Button
					mode="contained"
					onPress={handleAddFriend}
					style={[styles.addBtn, { backgroundColor: colors.primary }]}
					compact
				>
					Add Friend
				</Button>
			</View>
			<Snackbar
				visible={snackbarMsg.length > 0}
				duration={5000}
				onDismiss={() => setSnackbarMsg('')}
				style={{ backgroundColor: colors.surfaceElevated ?? colors.surface }}
			>
				{snackbarMsg}
			</Snackbar>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: 14,
		padding: 16,
		marginBottom: 12,
		borderWidth: 1,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	left: {
		flexDirection: 'row',
		gap: 12,
		flex: 1,
	},
	info: {
		flex: 1,
	},
	name: {
		fontSize: 16,
		fontWeight: '600',
	},
	email: {
		fontSize: 13,
		marginTop: 2,
	},
	badgeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		marginTop: 6,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	badgeText: {
		fontSize: 12,
		fontWeight: '600',
	},
	addBtn: {
		borderRadius: 12,
		marginLeft: 12,
	},
});
