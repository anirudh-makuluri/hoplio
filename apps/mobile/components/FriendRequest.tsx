import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Avatar, Button, Text } from 'react-native-paper';
import { useUser } from '~/app/providers';
import { TRoomData, TUser } from '~/lib/types';
import { genRoomId } from '~/lib/utils';
import { joinChatRoom } from '~/redux/chatSlice';
import { joinSocketRoom } from '~/redux/socketSlice';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { useTheme } from '~/lib/themeContext';

export default function FriendRequest({ invitedUser }: { invitedUser: TUser }) {
	const { user, updateUser } = useUser();
	const { colors } = useTheme();
	const socket = useAppSelector((state) => state.socket.socket);
	const dispatch = useAppDispatch();

	function respondToRequest(accepted: boolean) {
		if (!user || !socket) return;

		socket.emit(
			'respond_friend_request_client_to_server',
			{
				uid: user.uid,
				requestUid: invitedUser.uid,
				isAccepted: accepted,
			},
			(response: any) => {
				if (response.success) {
					const receivedReqs = user.received_friend_requests;
					const reqIdx = receivedReqs.findIndex((u) => u.uid === invitedUser.uid);
					if (reqIdx !== -1) {
						receivedReqs.splice(reqIdx, 1);
					}
					const friendList = user.friend_list;
					const rooms = user.rooms;

					if (accepted) {
						friendList.push(invitedUser);
						const newRoomId: string = genRoomId(invitedUser.uid, user.uid);
						const newRoomData: TRoomData = {
							is_group: false,
							messages: [],
							saved_messages: [],
							name: invitedUser.name,
							photo_url: invitedUser.photo_url,
							roomId: newRoomId,
						};
						rooms.push(newRoomData);
						dispatch(joinSocketRoom(newRoomId));
						dispatch(joinChatRoom(newRoomData));
					}

					updateUser({
						received_friend_requests: receivedReqs,
						friend_list: friendList,
						rooms,
					});
				} else {
					console.warn(response.error);
				}
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
						source={{ uri: invitedUser.photo_url }}
						style={{ borderWidth: 2, borderColor: colors.border }}
					/>
					<View style={styles.info}>
						<Text style={[styles.name, { color: colors.text }]}>{invitedUser.name}</Text>
						<Text style={[styles.email, { color: colors.textSecondary }]}>
							{invitedUser.email}
						</Text>
						<View style={styles.badgeRow}>
							<View
								style={[
									styles.dot,
									{ backgroundColor: colors.primary },
								]}
							/>
							<Text style={[styles.badgeText, { color: colors.primary }]}>
								Wants to be friends
							</Text>
						</View>
					</View>
				</View>
				<View style={styles.actions}>
					<Button
						mode="contained"
						onPress={() => respondToRequest(true)}
						style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
						compact
					>
						Accept
					</Button>
					<Button
						mode="outlined"
						onPress={() => respondToRequest(false)}
						textColor={colors.destructive}
						style={[styles.declineBtn, { borderColor: colors.destructive }]}
						compact
					>
						Decline
					</Button>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		marginHorizontal: 16,
		marginVertical: 6,
		borderRadius: 14,
		borderWidth: 1,
		padding: 16,
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
		gap: 2,
	},
	name: {
		fontSize: 16,
		fontWeight: '600',
	},
	email: {
		fontSize: 13,
	},
	badgeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		marginTop: 4,
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
	actions: {
		flexDirection: 'row',
		gap: 8,
		marginLeft: 12,
	},
	acceptBtn: {
		borderRadius: 12,
	},
	declineBtn: {
		borderRadius: 12,
	},
});
