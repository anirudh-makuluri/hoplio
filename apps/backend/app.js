const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const admin = require('firebase-admin');
const cors = require('cors');
const fileUpload = require('express-fileupload');

const logger = require('./logger');
const config = require('./config');
const sessionRouter = require('./routers/session-router');
const usersRouter = require('./routers/users-router');
const scheduledMessagesRouter = require('./routers/scheduled-messages-router');
const e2eeRouter = require('./routers/e2ee-router');
const SchedulerService = require('./helpers/scheduler-helper');
const searchRouter = require('./routers/search-router');
const { attachSocketServer } = require('./socket-server');

async function bootstrap() {
	const app = express();
	const httpServer = createServer(app);
	const io = new Server(httpServer, {
		cors: {
			origin: config.allowedOrigins,
			methods: ['GET', 'POST'],
			credentials: true
		}
	});

	app.use((req, res, next) => {
		const origin = req.headers.origin;
		if (origin && config.allowedOrigins.includes(origin)) {
			res.setHeader('Access-Control-Allow-Origin', origin);
		}
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
		res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
		res.setHeader('Access-Control-Allow-Credentials', true);
		next();
	});

	app.use(cors({
		origin: true,
		credentials: true
	}));

	app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
	app.use(express.urlencoded({ extended: true }));
	app.use(cookieParser());
	app.use(fileUpload());

	admin.initializeApp({
		credential: admin.credential.cert(config.serviceAccount),
		storageBucket: config.firebase.storageBucketName
	});

	config.firebase.admin = admin;
	config.firebase.db = admin.firestore();
	config.firebase.storageBucket = admin.storage().bucket();

	try {
		await config.firebase.storageBucket.setCorsConfiguration([config.storageBucketCorsConfiguration]);
		logger.info(`Bucket ${config.firebase.storageBucketName} is updated with the CORS config`);
	} catch (error) {
		logger.error('Failed to configure storage bucket CORS:', error);
	}

	const { realtimeService } = attachSocketServer(io);
	await realtimeService.start();

	const schedulerService = new SchedulerService(io, realtimeService);
	schedulerService.start();

	app.get('/health', (req, res) => {
		res.json({
			status: 'ok',
			service: 'hoplio-backend',
			timestamp: new Date().toISOString(),
			env: config.appEnv
		});
	});

	app.get('/ready', (req, res) => {
		const realtimeStatus = realtimeService.getStatus();
		const ready = Boolean(config.firebase.db) && realtimeStatus.ready;

		res.status(ready ? 200 : 503).json({
			status: ready ? 'ready' : 'not-ready',
			timestamp: new Date().toISOString(),
			firebase: {
				initialized: Boolean(config.firebase.db)
			},
			realtime: realtimeStatus
		});
	});

	app.use(sessionRouter);
	app.use(usersRouter);
	app.use(e2eeRouter);
	app.use('/api/scheduled-messages', scheduledMessagesRouter);
	app.use('/api', searchRouter);

	httpServer.listen(config.PORT, () => {
		logger.info(`Server is running on port ${config.PORT}`);
	});
}

bootstrap().catch((error) => {
	logger.error('Failed to bootstrap backend:', error);
	process.exitCode = 1;
});
