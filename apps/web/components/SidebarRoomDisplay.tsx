import { TRoomData } from '@/lib/types'
import { Avatar, AvatarImage } from '@radix-ui/react-avatar'
import React from 'react'
import { Card, CardTitle, CardHeader, CardContent } from './ui/card'
import { useAppDispatch, useAppSelector } from '@/redux/store'
import { setActiveRoomId } from '@/redux/chatSlice'
import { useUser } from '@/app/providers'

export default function SidebarRoomDisplay({ roomData }: { roomData: TRoomData }) {
	const dispatch = useAppDispatch();
	const { user } = useUser();
	const rooms = useAppSelector(state => state.chat.rooms);
	const activeChatRoomId = useAppSelector(state => state.chat.activeChatRoomId);
	const unreadCount = useAppSelector(state => state.chat.unreadCounts[roomData.roomId] || 0);

	function changeActiveRoom() {
		if(!user) return;
		dispatch(setActiveRoomId(roomData.roomId));
	}

	function getLastChatMessage() {
		if(!user) return null;

		const currentMessages = rooms[roomData.roomId]?.messages || roomData.messages || [];
		for (let index = currentMessages.length - 1; index >= 0; index -= 1) {
			const message = currentMessages[index];
			if (!message || message.isDate) continue;
			return message;
		}

		return null;
	}

	function getLastMessage() {
		const lastMesage = getLastChatMessage();
		if(!user || !lastMesage) return "Start a conversation";

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

	function getLastMessageTime() {
		const lastMessage = getLastChatMessage();
		if (!lastMessage?.time) return '';

		const messageTime = new Date(lastMessage.time);
		if (Number.isNaN(messageTime.getTime())) return '';

		const now = new Date();
		if (now.toDateString() === messageTime.toDateString()) {
			return messageTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
		}

		const diffInDays = Math.floor((now.getTime() - messageTime.getTime()) / 86400000);
		if (diffInDays < 7) {
			return messageTime.toLocaleDateString([], { weekday: 'short' });
		}

		return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
		<Card onClick={changeActiveRoom} className={`mb-2 cursor-pointer border-white/10 transition-all duration-300 ${activeChatRoomId === roomData.roomId ? 'border-cyan-400/20 bg-gradient-to-r from-cyan-500/14 via-slate-900/88 to-blue-500/12 shadow-[0_18px_42px_-30px_rgba(34,211,238,0.35)]' : 'bg-slate-950/42 hover:bg-slate-900/72'}`}>
			<CardHeader className='pb-3'>
				<CardTitle className='flex flex-row items-center justify-between gap-2'>
					<div className='flex min-w-0 flex-row items-center gap-2'>
						<div className='relative'>
							<Avatar>
								<AvatarImage className='h-10 w-10 rounded-full border border-white/10' src={roomData.photo_url} referrerPolicy='no-referrer' />
							</Avatar>
							{isOtherOnline() && (
								<span className='absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-slate-950'></span>
							)}
						</div>
						<div className='min-w-0'>
							<p className='truncate text-sm font-medium text-slate-50'>{roomData.name}</p>
						</div>
					</div>
					<div className='ml-2 flex items-center gap-2'>
						{getLastMessageTime() && (
							<span className='text-[11px] font-medium text-muted-foreground'>
								{getLastMessageTime()}
							</span>
						)}
						{unreadCount > 0 && (
							<span className='inline-flex min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-1.5 py-0.5 text-xs font-semibold text-slate-950'>
								{unreadCount > 99 ? '99+' : unreadCount}
							</span>
						)}
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent className='pt-0'>
				<p className='truncate text-sm text-muted-foreground'>{getLastMessage()}</p>
			</CardContent>
		</Card>
	)
}
