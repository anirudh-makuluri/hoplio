import type { ReactNode } from 'react';
import { Slot } from "expo-router";
import { Providers } from './providers'
import { useAppUpdates } from '../lib/useAppUpdates'

// Import your global CSS file
import "../global.css"
import { globals } from '~/globals';

function AppUpdatesGate({ children }: { children: ReactNode }) {
	useAppUpdates();
	console.log(`Using backend URL: ${globals.BACKEND_URL}`);
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
