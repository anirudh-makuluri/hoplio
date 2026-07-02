'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useUser } from '@/app/providers'
import {
	LogOut,
	PencilIcon,
	Save,
	UserRoundPlus
} from 'lucide-react'
import { Button } from '../../components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import FriendRequest from '../../components/FriendRequest';
import { Avatar } from '@/components/ui/avatar';
import { AvatarImage } from '@radix-ui/react-avatar';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { clearRoomData } from '@/redux/chatSlice';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import CropperOverlay from '@/components/CropperOverlay';
import { dataURIToBlob } from '@/lib/utils';
import { globals } from '@/globals';

export default function MenuBar() {
	const { user, logout, updateUser } = useUser();
	const dispatch = useAppDispatch();
	const socket = useAppSelector(state => state.socket.socket);
	const { toast } = useToast();

	const imageRef = useRef<HTMLInputElement | null>(null);

	const [isUserNameEditable, setUserNameEditable] = useState<boolean>(false);
	const [newUserName, setNewUserName] = useState<string>(user?.name || "");

	const [isCropperOverlayVisible, setCropperOverlayVisibility] = useState(false);
	const [profileUrl, setProfileUrl] = useState("");

	useEffect(() => {
		if (!user || !socket) return;

		if (!isUserNameEditable && newUserName != user.name && newUserName.trim() != "") {
			const newData = {
				name: newUserName
			}
			socket.emit('update_user_data', { newData }, (response: any) => {
				if (response.success) {
					updateUser(newData);
					toast({
						description: "User name updated"
					})
				} else {
					toast({
						description: JSON.stringify(response.error)
					})
				}
			})
		}

	}, [isUserNameEditable, newUserName, user, socket, updateUser, toast]);

	function onToggleUserNameEdit() {
		setUserNameEditable((prev) => {
			const next = !prev;
			if (!next && user && (newUserName === user.name || newUserName.trim() === "")) {
				setNewUserName(user.name);
			}
			return next;
		});
	}

	function logOut() {
		dispatch(clearRoomData());
		logout();
	}

	function openImageChoose() {
		if (!imageRef.current) return;

		imageRef.current.click();

		imageRef.current.onchange = (e: any) => {
			const file = e.target?.files[0];
			const nextProfileUrl = URL.createObjectURL(file);
			setProfileUrl(nextProfileUrl);
			setCropperOverlayVisibility(true);
		}
	}

	function saveProfilePhoto(url: string) {
		if (!user || !socket) return;

		const storagePath = `${encodeURIComponent(user.uid)}-profile_photo`;

		saveFileToStorage(url, storagePath)?.then((downloadUrl) => {
			const newData = {
				photo_url: downloadUrl
			}

			socket.emit('update_user_data', { newData }, (response: any) => {
				if (response.success) {
					updateUser(newData);
					toast({
						description: "User photo updated"
					})
				} else {
					toast({
						description: JSON.stringify(response.error)
					})
				}
			})
		}).catch((err : any) => {
			toast({
				description: JSON.stringify(err)
			})
		}).finally(() => {
			setCropperOverlayVisibility(false);
		})
	}

	function saveFileToStorage(url: string, storagePath : string) {
		if (!user || !socket) return;

		const photoBlob = dataURIToBlob(url);

		const formData = new FormData();
		formData.append("file", photoBlob);

		return fetch(`${globals.BACKEND_URL}/users/${user.uid}/files?storagePath=${storagePath}`, {
			method: 'POST',
			body: formData
		}).then(res => res.json())
			.then((response: any) => {
				if (response.success) {
					return response.downloadUrl;
				}
				throw response;
			})
	}

	return (
		<div className='app-panel flex h-full w-[88px] flex-col items-center justify-between px-3 py-4'>
			<Dialog>
				<DialogTrigger asChild>
					<Button disabled={user?.received_friend_requests?.length == 0} size='icon' variant='outline' className='relative h-11 w-11 rounded-2xl'>
						<div
							style={{ display: user?.received_friend_requests?.length || 0 > 0 ? "flex" : "none" }}
							className='absolute -right-1 -top-1 min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm'
						>
							{user?.received_friend_requests?.length}
						</div>
						<UserRoundPlus className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
					</Button>
				</DialogTrigger>
				<DialogContent className='sm:max-w-[460px]'>
					<DialogHeader>
						<DialogTitle>Friend Requests</DialogTitle>
					</DialogHeader>
					<div className='flex max-h-[50vh] flex-col gap-4 overflow-y-auto px-2'>
						{user?.received_friend_requests.map((invitedUser) => (
							<FriendRequest
								invitedUser={invitedUser}
								key={invitedUser.uid}
							/>
						))}
					</div>
				</DialogContent>
			</Dialog>

			<div className='flex flex-col items-center gap-3'>
				<div className='app-gradient-text text-xs font-semibold uppercase tracking-[0.28em] [writing-mode:vertical-rl]'>
					hoplio
				</div>
				<Popover>
					<PopoverTrigger asChild>
						<Button variant='outline' size='icon' className='h-12 w-12 rounded-2xl'>
							<Avatar className='h-8 w-8'>
								<AvatarImage src={user?.photo_url} />
							</Avatar>
						</Button>
					</PopoverTrigger>
					<PopoverContent className='w-80 space-y-6 rounded-[1.5rem] border border-white/10 bg-slate-950/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,1)] backdrop-blur-2xl'>
						<div className='space-y-1'>
							<p className='text-xs font-medium uppercase tracking-[0.22em] text-cyan-300'>Profile</p>
							<p className='text-sm text-muted-foreground'>Update your photo or name so friends can recognize you instantly.</p>
						</div>
						<div onClick={openImageChoose} className='group relative w-20 cursor-pointer'>
							<Avatar className='h-20 w-20'>
								<AvatarImage src={user?.photo_url} />
							</Avatar>
							<div className='absolute top-0 hidden h-20 w-20 items-center justify-center rounded-full bg-slate-900/35 text-white group-hover:flex'>
								<PencilIcon size={18} />
							</div>
							<Input className='hidden' ref={imageRef} type='file' accept='image/*' />
						</div>
						<div className='flex w-full flex-row items-center justify-between'>
							{isUserNameEditable ? (
								<Input className='text-lg' value={newUserName} onChange={e => setNewUserName(e.target.value)} />
							) : (
								<p className='text-lg font-medium text-slate-50'>{user?.name}</p>
							)}
							<Button className='ml-2' onClick={onToggleUserNameEdit} variant={isUserNameEditable ? 'default' : 'ghost'}>
								{isUserNameEditable ? <Save size={18} /> : <PencilIcon size={18} />}
							</Button>
						</div>
						<div className='flex w-full items-center justify-center'>
							<Button onClick={logOut} variant='destructive' className='w-full'>
								<LogOut className='mr-2 h-4 w-4' />
								<p>Log out</p>
							</Button>
						</div>
					</PopoverContent>
				</Popover>
			</div>

			<CropperOverlay
				url={profileUrl}
				isCropperOverlayVisible={isCropperOverlayVisible}
				setCropperOverlayVisibility={setCropperOverlayVisibility}
				saveCroppedImage={saveProfilePhoto}
			/>
		</div>
	)
}
