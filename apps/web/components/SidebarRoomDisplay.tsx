import { TRoomData } from '@/lib/types'
import React from 'react'
import { Card, CardTitle, CardHeader, CardContent } from './ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@radix-ui/react-avatar'
import { useAppDispatch, useAppSelector } from '@/redux/store'
import { setActiveRoomId } from '@/redux/chatSlice'
import { useUser } from '@/app/providers'


export default function SidebarRoomDisplay({ roomData }: { roomData: TRoomData }) {
	const dispatch = useAppDispatch();
	const {	user } = useUser();
	const rooms = useAppSelector(state => state.chat.rooms);
	const unreadCount = useAppSelector(state => state.chat.unreadCounts[roomData.roomId] || 0);

	function changeActiveRoom() {
		if(!user) return;

		dispatch(setActiveRoomId(roomData.roomId));
	}

	function getLastMessage() {
		if(!user || rooms[roomData.roomId] == null) return "Start a conversation"

		const currentMessages = rooms[roomData.roomId].messages;
		if(currentMessages.length == 0) return "Start a conversation";

		const lastMesage = currentMessages[currentMessages.length - 1];

		switch (lastMesage.type) {
			case 'text':
				return `${lastMesage.userUid == user.uid ? "You" : lastMesage.userName} : ${lastMesage.chatInfo}`
			case 'image':
			case 'gif':
				return `${lastMesage.userUid == user.uid ? "You" : lastMesage.userName} : Photo`
			case 'file':
				return `${lastMesage.userUid == user.uid ? "You" : lastMesage.userName} : ${lastMesage.fileName || 'File'}`
			default:
				return `${lastMesage.userUid == user.uid ? "You" : lastMesage.userName} : Sent a message`
		}
	}

	function isOtherOnline() {
		if (roomData.is_group) return false;
		if (!user) return false;
		const other = roomData.membersData.find(m => m.uid !== user.uid);
		return !!other?.is_online;
	}

	if(!user) {
		return;
	}

	return (
		<Card onClick={changeActiveRoom} className='cursor-pointer hover:bg-primary duration-300 rounded-none border-r-0 border-l-0'>
			<CardHeader>
				<CardTitle className='flex flex-row gap-2 items-center justify-between'>
					<div className='flex flex-row gap-2 items-center min-w-0'>
					<div className='relative'>
						<Avatar>
							<AvatarImage className='h-6 w-6 rounded-full' src={roomData.photo_url} referrerPolicy='no-referrer' />
						</Avatar>
						{isOtherOnline() && (
							<span className='absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background'></span>
						)}
					</div>
						<p className='truncate'>{roomData.name}</p>
					</div>
					{unreadCount > 0 && (
						<span className='inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground'>
							{unreadCount > 99 ? '99+' : unreadCount}
						</span>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p className='text-sm opacity-50 truncate'>{getLastMessage()}</p>
			</CardContent>
		</Card>
	)
}
