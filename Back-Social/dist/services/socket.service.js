"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../models/user.model");
class SocketService {
    constructor(server) {
        this.userSockets = new Map();
        this.userStatus = new Map();
        this.io = new socket_io_1.Server(server, {
            pingTimeout: 60000,
            cors: {
                origin: process.env.CLIENT_URL || 'http://localhost:4200',
                credentials: true,
                methods: ['GET', 'POST']
            },
            transports: ['websocket', 'polling']
        });
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    setupMiddleware() {
        this.io.use((socket, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    console.log('Socket authentication token:field', token);
                    console.log('Socket authentication token:field', token);
                    console.log('Socket authentication disconnected');
                    socket.disconnect();
                    throw new Error('Authentication error');
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                console.log(decoded);
                socket.user = decoded;
                next();
            }
            catch (error) {
                next(new Error('Authentication error'));
            }
        }));
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            var _a;
            if (!((_a = socket.user) === null || _a === void 0 ? void 0 : _a.id)) {
                socket.disconnect();
                return;
            }
            const userId = socket.user.id.toString();
            console.log('User connected:', userId);
            // Store socket connection and update online status
            this.userSockets.set(userId, socket.id);
            this.updateUserStatus(userId, 'online');
            this.broadcastUserStatus(userId, 'online');
            // Chat room events
            socket.on('join_chat', (chatId) => {
                socket.join(chatId);
                socket.to(chatId).emit('user_joined', {
                    chatId,
                    user: socket.user
                });
            });
            socket.on('leave_chat', (chatId) => {
                socket.leave(chatId);
                socket.to(chatId).emit('user_left', {
                    chatId,
                    user: socket.user
                });
            });
            // Messaging events
            socket.on('new_message', (message) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                const chatId = message.chatId;
                if (!chatId)
                    return;
                // Broadcast the message to all users in the chat room
                socket.to(chatId).emit('new_message', Object.assign(Object.assign({}, message), { _id: Date.now().toString(), timestamp: new Date(), readBy: [(_a = socket.user) === null || _a === void 0 ? void 0 : _a.id], sender: {
                        _id: (_b = socket.user) === null || _b === void 0 ? void 0 : _b.id,
                        username: (_c = socket.user) === null || _c === void 0 ? void 0 : _c.username,
                        avatar: (_d = socket.user) === null || _d === void 0 ? void 0 : _d.avatar
                    }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
                // Send delivery status back to sender
                socket.emit('message_delivered', {
                    messageId: message._id,
                    status: 'delivered',
                    timestamp: new Date()
                });
            }));
            // Typing indicators
            socket.on('typing_status', ({ chatId, isTyping }) => {
                socket.to(chatId).emit(isTyping ? 'typing_started' : 'typing_stopped', {
                    chatId,
                    user: socket.user
                });
            });
            // Friend system events
            socket.on('friend_request', (userId) => {
                var _a;
                console.log(`Friend request from user: ${(_a = socket.user) === null || _a === void 0 ? void 0 : _a.id} to user: ${userId}`);
                const recipientSocket = this.userSockets.get(userId);
                if (recipientSocket) {
                    this.io.to(recipientSocket).emit('new_friend_request', {
                        sender: socket.user,
                        timestamp: new Date()
                    });
                    console.log(`Friend request sent to user: ${userId}`);
                }
            });
            socket.on('friend_request_response', ({ userId, status }) => {
                const senderSocket = this.userSockets.get(userId);
                if (senderSocket) {
                    this.io.to(senderSocket).emit('friend_request_response', {
                        status,
                        user: socket.user,
                        timestamp: new Date()
                    });
                }
            });
            // User status events
            socket.on('set_status', (status) => {
                this.updateUserStatus(userId, status);
                this.broadcastUserStatus(userId, status);
            });
            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('User disconnected:', userId);
                this.userSockets.delete(userId);
                this.updateUserStatus(userId, 'offline', new Date());
                this.broadcastUserStatus(userId, 'offline');
            });
        });
    }
    updateUserStatus(userId, status, lastSeen) {
        return __awaiter(this, void 0, void 0, function* () {
            this.userStatus.set(userId, {
                userId,
                status,
                lastSeen
            });
            try {
                const updateUserStates = yield user_model_1.User.updateOne({ _id: userId }, { userStatus: status, lastSeen });
                console.log(`Updated user status for ${userId}:`, updateUserStates);
            }
            catch (error) {
                console.error(`Failed to update status for user ${userId}:`, error);
            }
        });
    }
    broadcastUserStatus(userId, status) {
        // Notify friends about status change
        this.io.emit('user_status_changed', {
            userId,
            status,
            timestamp: new Date()
        });
    }
    // Public methods for external use
    emitToUser(userId, event, data) {
        const socketId = this.userSockets.get(userId);
        console.log('Emitting to user:', userId, 'Event:', event, 'Data:', data);
        console.log('Socket ID:', socketId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
        }
    }
    emitToChat(chatId, event, data) {
        this.io.to(chatId).emit(event, data);
    }
    broadcastEvent(event, data) {
        this.io.emit(event, data);
    }
    getUserStatus(userId) {
        return this.userStatus.get(userId);
    }
    isUserOnline(userId) {
        const status = this.userStatus.get(userId);
        return (status === null || status === void 0 ? void 0 : status.status) === 'online';
    }
}
exports.SocketService = SocketService;
