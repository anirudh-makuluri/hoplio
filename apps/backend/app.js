const express = require('express');
const { createServer } = require('http')
const { Server } = require("socket.io");
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

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: config.allowedOrigins,
		methods: ['GET', 'POST'],
		credentials: true
	}
});

httpServer.listen(config.PORT, () => {
	logger.info(`Server is running on port ${config.PORT}`);
})

app.use((req, res, next) => {
	const origin = req.headers.origin;
    if (config.allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Headers', "Origin, X-Requested-With, Content-Type, Accept");
	res.setHeader('Access-Control-Allow-Credentials', true);
	next();
});

const corsOptions = {
	origin: true, //included origin as true
	credentials: true, //included credentials as true
};

app.use(cors(corsOptions));

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf } }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload());
app.use(sessionRouter);
app.use(usersRouter);
app.use(e2eeRouter);
app.use('/api/scheduled-messages', scheduledMessagesRouter);
app.use('/api', searchRouter);


admin.initializeApp({
	credential: admin.credential.cert(config.serviceAccount),
	storageBucket: config.firebase.storageBucketName
})

config.firebase.admin = admin;
config.firebase.db = admin.firestore()
const bucket = admin.storage().bucket();
config.firebase.storageBucket = bucket;

configureStorageBucketCors();
async function configureStorageBucketCors() {
	await config.firebase.storageBucket.setCorsConfiguration([config.storageBucketCorsConfiguration])
	.then(() => logger.info(`Bucket ${config.firebase.storageBucketName} is updated with the CORS config`))
	.catch(e => logger.error('Failed to configure storage bucket CORS:', e));
}

const { sessionStore, roomList } = attachSocketServer(io);
const schedulerService = new SchedulerService(io, roomList);

// Start the scheduler service
schedulerService.start();

// Cleanup Maps periodically to prevent memory leaks
// Clean up rooms that have no active connections every 30 minutes
setInterval(() => {
	const roomsToDelete = [];
	for (const [roomId, room] of roomList.entries()) {
		const roomSockets = io.sockets.adapter.rooms.get(roomId);
		if (!roomSockets || roomSockets.size === 0) {
			roomsToDelete.push(roomId);
		}
	}
	
	roomsToDelete.forEach(roomId => {
		roomList.delete(roomId);
		logger.debug(`Cleaned up inactive room: ${roomId}`);
	});
	
	if (roomsToDelete.length > 0) {
		logger.info(`Cleaned up ${roomsToDelete.length} inactive rooms`);
	}
	
	// Clean up stale sessions (sessions without active socket connections)
	const sessionsToDelete = [];
	for (const [uid, session] of sessionStore.entries()) {
		const socket = io.sockets.sockets.get(session.currentSocketId);
		if (!socket || !socket.connected) {
			sessionsToDelete.push(uid);
		}
	}
	
	sessionsToDelete.forEach(uid => {
		sessionStore.delete(uid);
		logger.debug(`Cleaned up stale session: ${uid}`);
	});
	
	if (sessionsToDelete.length > 0) {
		logger.info(`Cleaned up ${sessionsToDelete.length} stale sessions`);
	}
}, 30 * 60 * 1000); // Run every 30 minutes
