import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/database';
import { errorHandler } from './middlewares/error';
import { SocketService } from './services/socket.service';
import morgan from 'morgan';

// Route imports
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import chatRoutes from './routes/chat.routes';
import messageRoutes from './routes/message.routes';
import friendRoutes from './routes/friend.routes';

// Load env vars
dotenv.config();
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

// Connect to database
connectDB();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
import { initializeSocket } from './services/socket-context';
const socketService = initializeSocket(httpServer);

// Body parser
app.use(express.json());
app.use(morgan('dev'));
// Enable CORS
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:4200',
    credentials: true
}));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check route
app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({
        status: 'success',
        message: 'API is running',
        version: process.env.API_VERSION,
        timestamp: new Date()
    });
});

// Mount routers
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/posts`, postRoutes);
app.use(`${API_PREFIX}/chats`, chatRoutes);
app.use(`${API_PREFIX}/messages`, messageRoutes);
app.use(`${API_PREFIX}/friends`, friendRoutes);

// 404 handler
app.use((req, res, next) => {
    const error = new Error('Not Found') as any;
    error.status = 404;
    next(error);
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
