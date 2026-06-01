const config = require('../config');

function isProductionCookie() {
	if (typeof process.env.SESSION_COOKIE_SECURE === 'string') {
		return process.env.SESSION_COOKIE_SECURE === 'true';
	}

	return process.env.NODE_ENV === 'production';
}

function getSessionCookieOptions(maxAge) {
	const secure = isProductionCookie();
	const options = {
		httpOnly: true,
		secure,
		sameSite: secure ? 'none' : 'lax'
	};

	if (typeof maxAge === 'number') {
		options.maxAge = maxAge;
	}

	if (process.env.SESSION_COOKIE_DOMAIN) {
		options.domain = process.env.SESSION_COOKIE_DOMAIN;
	}

	return options;
}

async function verifySessionCookie(sessionCookie, checkRevoked = true) {
	if (!sessionCookie) {
		throw new Error('No session found, please login');
	}

	return config.firebase.admin.auth().verifySessionCookie(sessionCookie, checkRevoked);
}

async function requireSession(req, res, next) {
	try {
		const sessionCookie = req.cookies?.session || '';
		const decoded = await verifySessionCookie(sessionCookie, true);
		req.uid = decoded.uid;
		req.user = decoded;
		return next();
	} catch (error) {
		res.clearCookie('session', getSessionCookieOptions());
		return res.status(401).json({ error: 'Session invalid, please login again' });
	}
}

module.exports = {
	getSessionCookieOptions,
	requireSession,
	verifySessionCookie
};
