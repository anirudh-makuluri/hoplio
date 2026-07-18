import type { ReactNode } from 'react';
import { Slot } from "expo-router";
import { Providers } from './providers'
import { useAppUpdates } from '../lib/useAppUpdates'

// Import your global CSS file
import "../global.css"

function AppUpdatesGate({ children }: { children: ReactNode }) {
	useAppUpdates();
	return <>{children}</>;
}

export default function HomeLayout() {
	return (
		<Providers>
			<AppUpdatesGate>
				<Slot/>
			</AppUpdatesGate>
		</Providers>
	)
}
