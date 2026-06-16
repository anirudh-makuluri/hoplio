import { TUser } from '@/lib/types'
import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from './ui/button'
import { useUser } from '@/app/providers'
import { useToast } from "@/components/ui/use-toast"
import { useAppSelector } from '@/redux/store'
import { Check, Clock3, Loader2, UserRoundPlus } from 'lucide-react'

export default function FetchedUser({ fetchedUser }: { fetchedUser: TUser }) {
	const { user, updateUser } = useUser();
	const socket = useAppSelector(state => state.socket.socket);
	const { toast } = useToast();
	const [isSubmitting, setIsSubmitting] = React.useState(false);

	const isSelf = user?.uid === fetchedUser.uid;
	const isAlreadyFriend = !!user?.friend_list?.some(friend => friend.uid === fetchedUser.uid);
	const isPending = !!user?.sent_friend_requests?.some(friend => friend.uid === fetchedUser.uid);

	function handleAddFriend() {
		if (!user) {
			toast({
				title: "Error",
				description: "User not logged in"
			})
			return;
		}

		if (!socket) {
			toast({
				title: "Error",
				description: "Reload the page and try again"
			})
			return;
		}

		setIsSubmitting(true);
		socket.emit('send_friend_request_client_to_server', { receiverUid: fetchedUser.uid }, (res: any) => {
			if (res.success) {
				if (!isPending) {
					updateUser({
						sent_friend_requests: [...(user.sent_friend_requests || []), fetchedUser]
					})
				}
				toast({
					title: "Success",
					description: res.success || `Friend request sent to ${fetchedUser.name}`
				})
			} else {
				toast({
					title: "Error",
					description: res.error
				})
			}
			setIsSubmitting(false);
		})
	}

	return (
		<div className='app-panel-muted flex flex-row items-center justify-between gap-4 px-4 py-4'>
			<div className='flex min-w-0 flex-row gap-3'>
				<Avatar className='h-11 w-11 border border-white/10'>
					<AvatarImage src={fetchedUser.photo_url} referrerPolicy='no-referrer' />
					<AvatarFallback>{fetchedUser.name[0]}</AvatarFallback>
				</Avatar>
				<div className='min-w-0 flex flex-col'>
					<p className='truncate text-sm font-medium text-slate-50'>{fetchedUser.name}</p>
					<p className='truncate text-xs text-muted-foreground'>{fetchedUser.email}</p>
				</div>
			</div>
			<Button
				onClick={handleAddFriend}
				disabled={isSubmitting || isSelf || isAlreadyFriend || isPending}
				variant={isAlreadyFriend || isPending || isSelf ? 'outline' : 'default'}
				className='min-w-[124px]'
			>
				{isSubmitting ? (
					<Loader2 className='h-4 w-4 animate-spin' />
				) : isSelf ? (
					'You'
				) : isAlreadyFriend ? (
					<>
						<Check className='mr-2 h-4 w-4' />
						Friends
					</>
				) : isPending ? (
					<>
						<Clock3 className='mr-2 h-4 w-4' />
						Pending
					</>
				) : (
					<>
						<UserRoundPlus className='mr-2 h-4 w-4' />
						Send Request
					</>
				)}
			</Button>
		</div>
	)
}
