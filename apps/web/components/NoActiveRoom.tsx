import React from 'react'

export default function NoActiveRoom() {
	return (
		<div className='flex h-full w-full items-center justify-center p-8'>
			<div className='app-panel-muted max-w-lg px-8 py-10 text-center'>
				<p className='text-xs font-medium uppercase tracking-[0.24em] text-cyan-300'>Ready when you are</p>
				<h1 className='mt-3 font-heading text-3xl font-semibold text-slate-50'>Pick a chat to jump back in.</h1>
				<p className='mt-3 text-base text-muted-foreground'>Select a conversation from the left panel to get started.</p>
			</div>
		</div>
	)
}
