"use client"
import React, { useEffect, useState } from 'react'
import { useUser } from '../providers'
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Room from './Room';
import Menubar from '@/app/home/MenuBar';
import { useAppSelector, useAppDispatch } from '@/redux/store';
import NoActiveRoom from '@/components/NoActiveRoom';
import { initAndJoinSocketRooms, joinSocketRoom } from '@/redux/socketSlice';
import { addMessage, deleteChatMessage, editChatMessage, joinChatRoom, saveChatMessage, updateChatReaction } from '@/redux/chatSlice';
import { ChatMessage, TDeleteEvent, TEditEvent, TReactionEvent, TRoomData, TSaveEvent, TUser, TPresenceUpdate } from '@/lib/types';
import { genRoomId } from '@/lib/utils';
import { useClientMediaQuery } from '@/lib/hooks/useClientMediaQuery';
import LoadingScreen from '@/components/LoadingScreen';
import { useE2EEInitialization, useDeviceId } from '@/lib/hooks/useE2EE';


export default function Page() {
	const { isLoading, user, updateUser } = useUser();
	const router = useRouter();
	const activeChatRoomId = useAppSelector(state => state.chat.activeChatRoomId);
	const socket = useAppSelector(state => state.socket.socket);
	const dispatch = useAppDispatch();
	const e2eeInitialized = useE2EEInitialization();
	const deviceId = useDeviceId();
	const isMobile = useClientMediaQuery('(max-width: 600px)');

	const [areRoomsInited, setRoomsInited] = useState(false);
	const isLoadingScreenVisible = !!user && e2eeInitialized && !areRoomsInited;

	function normalizeIncomingRoom(roomData: TRoomData): TRoomData {
		return {
			...roomData,
			messages: Array.isArray(roomData.messages) ? roomData.messages : [],
			membersData: Array.isArray(roomData.membersData) ? roomData.membersData : [],
			saved_messages: Array.isArray(roomData.saved_messages) ? roomData.saved_messages : []
		};
	}

	useEffect(() => {
		if (!isLoading && !user) {
			router.replace("/auth")
		}

		if (!user || areRoomsInited || !e2eeInitialized) return;

		const roomIds: string[] = user.rooms.map(u => u.roomId);

		dispatch(initAndJoinSocketRooms(roomIds, {
			email: user.email,
			name: user.name,
			photo_url: user.photo_url,
			uid: user.uid
		}));

		user.rooms.forEach((roomData) => {
			dispatch(joinChatRoom({ 
				roomData,
				userId: user.uid,
				deviceId
			}));
		});

		queueMicrotask(() => setRoomsInited(true));

	}, [user, isLoading, e2eeInitialized, areRoomsInited, deviceId, dispatch, router]);

	useEffect(() => {
		if (!socket) return;
		socket.on('presence_update', (data: TPresenceUpdate) => {
			if (!user) return;
			const updatedFriendList = (user.friend_list || []).map(f => f.uid === data.uid ? { ...f, is_online: data.is_online, last_seen: data.last_seen } : f);
			const updatedRooms = (user.rooms || []).map(r => ({
				...r,
				membersData: (r.membersData || []).map(m => m.uid === data.uid ? { ...m, is_online: data.is_online, last_seen: data.last_seen } : m)
			}));
			updateUser({ friend_list: updatedFriendList, rooms: updatedRooms });
		})

		socket.on('chat_event_server_to_client', (msg: ChatMessage) => {
			console.log("Received message from " + msg);
			dispatch(addMessage({ 
				message: msg,
				userId: user?.uid,
				deviceId: deviceId
			}))
			//if activechatroomid != msg.roomid dispatch(inrecementunreadmessages)
		})

		socket.on('send_friend_request_server_to_client', (data: TUser) => {
			console.log("Received friend request from " + data.name);
			const receivedFriendRequests = user?.received_friend_requests || [];
			receivedFriendRequests.push(data);
			updateUser({ received_friend_requests: receivedFriendRequests });
		})

		socket.on('respond_friend_request_server_to_client', (data: TUser) => {
			if (!user) return;

			//For now, socket is emitted only when the request is accepted. Might have to handle the other case in the future.

			const friendList = user.friend_list;
			const rooms = user.rooms;

			friendList.push(data);

			const newRoomId: string = genRoomId(data.uid, user.uid)
			const newRoomData: TRoomData = {
				is_group: false,
				messages: [],
				name: data.name,
				photo_url: data.photo_url,
				roomId: newRoomId,
				membersData: [data, {
					email: user.email,
					name: user.name,
					photo_url: user.photo_url,
					uid: user.uid
				}],
				saved_messages: []
			}
			rooms.push(newRoomData);

			dispatch(joinSocketRoom(newRoomId))
			dispatch(joinChatRoom({
				roomData: newRoomData,
				userId: user.uid,
				deviceId
			}))

			updateUser({
				friend_list: friendList,
				rooms
			})
		});

		socket.on('group_room_added_server_to_client', (incomingRoom: TRoomData) => {
			if (!user) return;

			const normalizedRoom = normalizeIncomingRoom(incomingRoom);
			const roomAlreadyExists = (user.rooms || []).some((room) => room.roomId === normalizedRoom.roomId);
			if (roomAlreadyExists) {
				return;
			}

			dispatch(joinSocketRoom(normalizedRoom.roomId));
			dispatch(joinChatRoom({
				roomData: normalizedRoom,
				userId: user.uid,
				deviceId
			}));

			updateUser({
				rooms: [...(user.rooms || []), normalizedRoom]
			});
		});

		socket.on('chat_reaction_server_to_client', (data : TReactionEvent) => {
			dispatch(updateChatReaction(data))
		})

		socket.on('chat_delete_server_to_client', (data : TDeleteEvent) => {
			dispatch(deleteChatMessage(data))
		})

		socket.on('chat_edit_server_to_client', (data : TEditEvent) => {
			dispatch(editChatMessage(data))
		})

		socket.on('chat_save_server_to_client', (data : TSaveEvent) => {
			dispatch(saveChatMessage(data))
		})

		return () => {
			socket.off("chat_event_server_to_client");
			socket.off("send_friend_request_server_to_client")
			socket.off('respond_friend_request_server_to_client');
			socket.off('group_room_added_server_to_client');
			socket.off('chat_reaction_server_to_client');
			socket.off('chat_delete_server_to_client');
			socket.off('chat_edit_server_to_client');
			socket.off('chat_save_server_to_client');
			socket.off('presence_update');
		}

	}, [socket, user, updateUser, dispatch, deviceId]);

	return (
		<div className='relative h-screen overflow-hidden p-3 md:p-4'>
			<div className='pointer-events-none absolute inset-0 overflow-hidden'>
				<div className='absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-cyan-400/18 blur-[120px]' />
				<div className='absolute bottom-[-10rem] right-[-6rem] h-80 w-80 rounded-full bg-blue-400/14 blur-[140px]' />
			</div>
			{isLoadingScreenVisible && <LoadingScreen/>}
			<div className='relative flex h-full gap-3'>
				<div style={{ display: activeChatRoomId == '' || !isMobile ? "flex" : "none" }} className="flex h-full w-full max-w-[430px] min-w-0 flex-row gap-3">
					<Menubar />
					<Sidebar />
				</div>
				{isMobile && activeChatRoomId != '' && (
					<div className='app-panel flex-1 overflow-hidden'>
						<Room/>
					</div>
				)}
				{!isMobile && (
					<div className='app-panel flex-1 overflow-hidden'>
						{activeChatRoomId != '' ? <Room /> : <NoActiveRoom />}
					</div>
				)}
			</div>
		</div>
	)
}
