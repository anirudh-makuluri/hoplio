import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import { useUser } from '~/app/providers';
import { TRoomData, TUser } from '~/lib/types';
import { genRoomId } from '~/lib/utils';
import { joinChatRoom } from '~/redux/chatSlice';
import { joinSocketRoom } from '~/redux/socketSlice';
import { useAppDispatch, useAppSelector } from '~/redux/store';
import { useTheme } from '~/lib/themeContext';
import { AppButton } from '~/components/ui';
import { hapticError, hapticSuccess } from '~/lib/haptics';

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
					if (accepted) {
						void hapticSuccess();
					} else {
						void hapticError();
					}
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
					void hapticError();
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
						<Text style={[styles.email, { color: colors.textSecondary }]}>{invitedUser.email}</Text>
						<View style={styles.badgeRow}>
							<View style={[styles.dot, { backgroundColor: colors.accent }]} />
							<Text style={[styles.badgeText, { color: colors.textSecondary }]}>Wants to be friends</Text>
						</View>
					</View>
				</View>
			</View>
			<View style={styles.actions}>
				<AppButton onPress={() => respondToRequest(true)} compact style={styles.actionBtn}>
					Accept
				</AppButton>
				<AppButton
					variant="secondary"
					onPress={() => respondToRequest(false)}
					compact
					style={styles.actionBtn}
				>
					Decline
				</AppButton>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		marginHorizontal: 16,
		marginVertical: 6,
		borderRadius: 16,
		borderWidth: 2,
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
		fontWeight: '700',
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
		fontWeight: '700',
	},
	actions: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 14,
	},
	actionBtn: {
		flex: 1,
	},
});
