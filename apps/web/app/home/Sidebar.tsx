'use client'

import React, { useMemo, useState } from 'react'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { customFetch } from '@/lib/utils';
import { TUser } from '@/lib/types';
import FetchedUser from '@/components/FetchedUser';
import { useUser } from '../providers';
import SidebarUser from '@/components/SidebarRoomDisplay';
import { useToast } from '@/components/ui/use-toast';
import AIAssistantButton from '@/components/AIAssistantButton';
import CreateGroupDialog from '@/components/CreateGroupDialog';
import { Loader2, Search, UserRoundPlus } from 'lucide-react';
import { useAppSelector } from '@/redux/store';

export default function Sidebar() {
	const user = useUser()?.user;
	const { toast } = useToast();
	const roomState = useAppSelector(state => state.chat.rooms);

	const [searchUser, setSearchUser] = useState<string>("");
	const [fetchedUsers, setFetchedUsers] = useState<TUser[]>([]);
	const [openFriendDialog, setOpenFriendDialog] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	const sortedRooms = useMemo(() => {
		const getLatestMessageTime = (roomId: string, fallbackMessages: any[] = []) => {
			const messages = roomState[roomId]?.messages || fallbackMessages;
			for (let index = messages.length - 1; index >= 0; index -= 1) {
				const message = messages[index];
				if (!message || message.isDate || !message.time) continue;
				const parsedTime = new Date(message.time).getTime();
				if (Number.isFinite(parsedTime)) {
					return parsedTime;
				}
			}
			return 0;
		};

		return [...(user?.rooms || [])].sort((roomA, roomB) => {
			const latestA = getLatestMessageTime(roomA.roomId, roomA.messages);
			const latestB = getLatestMessageTime(roomB.roomId, roomB.messages);
			if (latestA !== latestB) {
				return latestB - latestA;
			}
			return roomA.name.localeCompare(roomB.name);
		});
	}, [roomState, user]);

	function handleSubmitSearch() {
		const query = searchUser.trim();
		if (query === "") {
			toast({
				title: "Search for someone",
				description: "Enter a name or email to send a friend request."
			})
			return;
		}

		setIsSearching(true);
		setHasSearched(true);
		customFetch({
			pathName: 'users/search-user?searchuser=' + query
		}).then(res => {
			if (res.requiredUsers) {
				setFetchedUsers(res.requiredUsers);
				if (res.requiredUsers.length === 0) {
					toast({
						title: "No users found",
						description: "Try a different name or email."
					})
				}
			}
		}).finally(() => {
			setIsSearching(false);
		})
	}

	function onOpenFriendDialog(open: boolean) {
		setOpenFriendDialog(open);
		if (!open) {
			setSearchUser("");
			setFetchedUsers([]);
			setHasSearched(false);
		}
	}

	return (
		<div className='app-panel flex h-full w-full min-w-0 flex-col overflow-hidden'>
			<div className='border-b border-white/10 px-4 pb-4 pt-5'>
				<div className='mb-4 flex items-start justify-between gap-3'>
					<div>
						<p className='text-xs font-medium uppercase tracking-[0.24em] text-cyan-300'>Conversations</p>
						<h2 className='mt-1 font-heading text-2xl font-semibold text-slate-50'>Inbox</h2>
					</div>
					<div className='rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200'>
						{sortedRooms.length} rooms
					</div>
				</div>
				<AIAssistantButton />
				<div className='grid grid-cols-2 gap-2'>
					<Dialog open={openFriendDialog} onOpenChange={onOpenFriendDialog}>
						<DialogTrigger asChild>
							<Button variant='outline' className='w-full justify-start'>
								<UserRoundPlus className='mr-2 h-4 w-4' />
								Send Request
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-[520px]">
							<DialogHeader>
								<DialogTitle>Send a friend request</DialogTitle>
								<DialogDescription>
									Search by name or email, then send a request without leaving your inbox.
								</DialogDescription>
							</DialogHeader>
							<div className='space-y-4'>
								<div className='flex gap-2'>
									<Input
										value={searchUser}
										onChange={(e) => setSearchUser(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && handleSubmitSearch()}
										placeholder='Search by name or email'
									/>
									<Button onClick={handleSubmitSearch} disabled={isSearching}>
										{isSearching ? <Loader2 className='h-4 w-4 animate-spin' /> : <Search className='h-4 w-4' />}
									</Button>
								</div>
								<div className='max-h-[360px] space-y-3 overflow-y-auto pr-1'>
									{fetchedUsers.map((fetchedUser) => (
										<FetchedUser
											fetchedUser={fetchedUser}
											key={fetchedUser.uid}
										/>
									))}
									{hasSearched && !isSearching && fetchedUsers.length === 0 && (
										<div className='app-panel-muted px-4 py-6 text-center'>
											<p className='text-sm font-medium text-slate-50'>Nobody matched that search.</p>
											<p className='mt-1 text-sm text-muted-foreground'>Try a full email address or a more specific name.</p>
										</div>
									)}
								</div>
							</div>
						</DialogContent>
					</Dialog>
					<CreateGroupDialog friends={user?.friend_list || []} />
				</div>
			</div>
			<div className='flex-1 overflow-y-auto px-3 py-3'>
				{sortedRooms.map((roomData) => (
					<SidebarUser
						roomData={roomData}
						key={roomData.roomId}
					/>
				))}
				{sortedRooms.length == 0 && (
					<div className='flex h-full flex-col items-center justify-center gap-4 px-6 text-center'>
						<div className='app-panel-muted w-full px-5 py-8'>
							<p className='text-base font-medium text-slate-50'>Your inbox is waiting.</p>
							<p className='mt-2 text-sm text-muted-foreground'>Send a friend request or create a group to start your first conversation.</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
