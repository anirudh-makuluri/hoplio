function normalizeBaseUrl(value) {
	if (typeof value !== 'string') {
		return '';
	}

	return value.trim().replace(/\/+$/, '');
}

function createTimeoutSignal(timeoutMs) {
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		return { signal: undefined, cleanup() {} };
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(new Error('Notification dispatch timed out')), timeoutMs);

	return {
		signal: controller.signal,
		cleanup() {
			clearTimeout(timeout);
		}
	};
}

function createNotificationDispatcher(options = {}) {
	const logger = options.logger || require('../logger');
	const serviceConfig = options.serviceConfig || {};
	const fetchImpl = options.fetchImpl || globalThis.fetch;
	const baseUrl = normalizeBaseUrl(serviceConfig.baseUrl);
	const internalToken = typeof serviceConfig.internalToken === 'string'
		? serviceConfig.internalToken.trim()
		: '';
	const timeoutMs = Number(serviceConfig.timeoutMs) || 2000;

	function isEnabled() {
		return Boolean(baseUrl && internalToken && typeof fetchImpl === 'function');
	}

	return {
		isEnabled,
		async dispatchChatMessage(payload) {
			if (!isEnabled()) {
				return {
					skipped: true,
					reason: 'notification-service-not-configured'
				};
			}

			const { signal, cleanup } = createTimeoutSignal(timeoutMs);

			try {
				const response = await fetchImpl(`${baseUrl}/api/v1/internal/dispatch`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${internalToken}`
					},
					body: JSON.stringify(payload),
					signal
				});

				if (!response.ok) {
					const errorBody = await response.text().catch(() => '');
					throw new Error(`Notification dispatch failed with ${response.status}: ${errorBody || response.statusText}`);
				}

				return response.json().catch(() => ({ success: true }));
			} catch (error) {
				logger.error('Failed to dispatch notification payload:', error);
				throw error;
			} finally {
				cleanup();
			}
		}
	};
}

module.exports = {
	createNotificationDispatcher
};
