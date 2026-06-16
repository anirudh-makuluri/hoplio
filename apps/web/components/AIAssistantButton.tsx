'use client'
import React, { useState } from 'react'
import { Button } from './ui/button'
import { Bot, Loader2, Sparkles } from 'lucide-react'
import { useUser } from '@/app/providers'
import { useAppDispatch, useAppSelector } from '@/redux/store'
import { joinChatRoom, setActiveRoomId } from '@/redux/chatSlice'
import { joinSocketRoom } from '@/redux/socketSlice'
import { TAIRoomResponse } from '@/lib/types'
import { globals } from '@/globals'
import { useToast } from './ui/use-toast'
import { useDeviceId } from '@/lib/hooks/useE2EE'

export default function AIAssistantButton() {
	const user = useUser()?.user
	const dispatch = useAppDispatch()
	const rooms = useAppSelector(state => state.chat.rooms)
	const { toast } = useToast()
	const deviceId = useDeviceId()

	const [isCreating, setIsCreating] = useState(false)

	const aiRoom = user?.rooms?.find(room => room.is_ai_room === true)

	const createAndOpenAIRoom = async () => {
		if (!user) {
			toast({
				title: "Error",
				description: "You must be logged in to chat with AI",
				variant: "destructive"
			})
			return
		}

		if (aiRoom) {
			if (rooms[aiRoom.roomId]) {
				dispatch(setActiveRoomId(aiRoom.roomId))
				return
			}

			dispatch(joinSocketRoom(aiRoom.roomId))
			dispatch(joinChatRoom({
				roomData: aiRoom,
				userId: user.uid,
				deviceId
			}))
			dispatch(setActiveRoomId(aiRoom.roomId))
			return
		}

		setIsCreating(true)

		try {
			const response = await fetch(`${globals.BACKEND_URL}/users/${user.uid}/ai-assistant/room`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			const data: TAIRoomResponse = await response.json()

			if (data.success && data.room) {
				dispatch(joinSocketRoom(data.roomId!))
				dispatch(joinChatRoom({
					roomData: data.room,
					userId: user.uid,
					deviceId
				}))
				dispatch(setActiveRoomId(data.roomId!))

				toast({
					title: "AI Assistant Ready",
					description: "You can now chat with the AI assistant!",
				})
			} else {
				toast({
					title: "Error",
					description: data.error || "Failed to create AI assistant room",
					variant: "destructive"
				})
			}
		} catch (error) {
			console.error('Error creating AI room:', error)
			toast({
				title: "Error",
				description: "Failed to create AI assistant room",
				variant: "destructive"
			})
		} finally {
			setIsCreating(false)
		}
	}

	return (
		<Button
			onClick={createAndOpenAIRoom}
			disabled={isCreating}
			className="mb-2 w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:from-cyan-400 hover:to-blue-400 hover:shadow-cyan-500/30"
			size="lg"
		>
			{isCreating ? (
				<>
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					Creating...
				</>
			) : (
				<>
					<Bot className="mr-2 h-4 w-4" />
					{aiRoom ? (
						'Chat with AI Assistant'
					) : (
						<>
							<Sparkles className="mr-1 h-4 w-4" />
							New AI Assistant
						</>
					)}
				</>
			)}
		</Button>
	)
}
