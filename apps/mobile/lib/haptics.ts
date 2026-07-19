import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const canHaptic = Platform.OS === 'ios' || Platform.OS === 'android';

async function safe(fn: () => Promise<void>) {
	if (!canHaptic) return;
	try {
		await fn();
	} catch {
		// Haptics unavailable (simulator / unsupported device)
	}
}

/** Tab switch, chip select, list row open */
export function hapticLight() {
	return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Primary CTA, send message, accept friend */
export function hapticMedium() {
	return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Stronger press (destructive confirms, long-press open) */
export function hapticHeavy() {
	return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

/** Selection tick (filters, toggles) */
export function hapticSelection() {
	return safe(() => Haptics.selectionAsync());
}

/** Login success, send success, friend accepted */
export function hapticSuccess() {
	return safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Auth fail, send fail */
export function hapticError() {
	return safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** Soft warning */
export function hapticWarning() {
	return safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
