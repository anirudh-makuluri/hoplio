require('dotenv').config();

const DEFAULT_ALLOWED_ORIGINS = [
	'http://localhost:3000',
	'http://localhost:8192',
	'http://localhost:8081',
	'http://192.168.0.102:8081',
	'exp://192.168.0.102:8081',
	'https://chatify.anirudh-makuluri.xyz',
	'https://chatify-a.vercel.app'
];

function parseCsvEnv(name, fallback) {
	const value = process.env[name];
	if (!value) {
		return fallback;
	}

	return value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseIntegerEnv(name, fallback) {
	const value = Number(process.env[name]);
	return Number.isFinite(value) ? value : fallback;
}

const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';
const allowedOrigins = parseCsvEnv('ALLOWED_ORIGINS', DEFAULT_ALLOWED_ORIGINS);

const config = {
	PORT: process.env.PORT || 5000,
	appEnv,
	isProduction: appEnv === 'production',
	expiresIn: 60 * 60 * 24 * 60 * 1000,
	chatDocSize: 50,
	allowedOrigins,
	firebase: {
		storageBucketName: `${process.env.PROJECT_ID}.appspot.com`
	},
	serviceAccount: {
		type: process.env.TYPE,
		project_id: process.env.PROJECT_ID,
		private_key_id: process.env.PRIVATE_KEY_ID,
		private_key: process.env.PRIVATE_KEY
			? `-----BEGIN PRIVATE KEY-----\n${process.env.PRIVATE_KEY}\n-----END PRIVATE KEY-----`
			: undefined,
		client_email: process.env.CLIENT_EMAIL,
		client_id: process.env.CLIENT_ID,
		auth_uri: process.env.AUTH_URI,
		token_uri: process.env.TOKEN_URI,
		auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
		client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
		universe_domain: process.env.UNIVERSE_DOMAIN
	},
	zep: {
		apiKey: process.env.ZEP_API_KEY || ''
	},
	redis: {
		restUrl: process.env.UPSTASH_REDIS_REST_URL || '',
		restToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
		url: process.env.REDIS_URL || '',
		prefix: process.env.REDIS_KEY_PREFIX || `hoplio:${appEnv}`,
		sessionTtlSeconds: parseIntegerEnv('REDIS_SESSION_TTL_SECONDS', 60 * 60 * 6),
		enableSocketIoRedisAdapter: process.env.ENABLE_SOCKET_IO_REDIS_ADAPTER === 'true'
	},
	notificationService: {
		baseUrl: process.env.NOTIFICATION_SERVICE_URL || '',
		internalToken: process.env.NOTIFICATION_INTERNAL_TOKEN || '',
		timeoutMs: parseIntegerEnv('NOTIFICATION_SERVICE_TIMEOUT_MS', 2000)
	}
};

config.storageBucketCorsConfiguration = {
	origin: config.allowedOrigins,
	method: ['GET'],
	maxAgeSeconds: 3600
};

module.exports = config;
