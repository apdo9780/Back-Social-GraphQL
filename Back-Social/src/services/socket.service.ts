import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { IUser,User } from '../models/user.model';
import { Socket } from 'socket.io';


interface SocketWithUser extends Socket {
  user?: IUser;
}

interface OnlineStatus {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: Date;
}

export class SocketService {
  private io: SocketServer;
  private userSockets: Map<string, string> = new Map();
  private userStatus: Map<string, OnlineStatus> = new Map();

  constructor(server: Server) {
    this.io = new SocketServer(server, {
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

  private setupMiddleware() {
    this.io.use(async (socket: SocketWithUser, next) => {
      try {
        const token = socket.handshake.auth.token;     
        if (!token) {
          console.log('Socket authentication token:field', token);
          console.log('Socket authentication token:field', token);
          console.log('Socket authentication disconnected');
          socket.disconnect();
          throw new Error('Authentication error');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        console.log(decoded);
        socket.user = decoded;
        
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: SocketWithUser) => {
      if (!socket.user?.id) {
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
      socket.on('join_chat', (chatId: string) => {
        socket.join(chatId);
        socket.to(chatId).emit('user_joined', {
          chatId,
          user: socket.user
        });
      });

      socket.on('leave_chat', (chatId: string) => {
        socket.leave(chatId);
        socket.to(chatId).emit('user_left', {
          chatId,
          user: socket.user
        });
      });

      // Messaging events
      socket.on('new_message', async (message: any) => {
        const chatId = message.chatId;
        if (!chatId) return;

        // Broadcast the message to all users in the chat room
        socket.to(chatId).emit('new_message', {
          ...message,
          _id: Date.now().toString(), // temporary ID until persisted
          timestamp: new Date(),
          readBy: [socket.user?.id],
          sender: {
            _id: socket.user?.id,
            username: socket.user?.username,
            avatar: socket.user?.avatar
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Send delivery status back to sender
        socket.emit('message_delivered', {
          messageId: message._id,
          status: 'delivered',
          timestamp: new Date()
        });
      });

      // Typing indicators
      socket.on('typing_status', ({ chatId, isTyping }: { chatId: string; isTyping: boolean }) => {
        socket.to(chatId).emit(isTyping ? 'typing_started' : 'typing_stopped', {
          chatId,
          user: socket.user
        });
      });

      // Friend system events
      socket.on('friend_request', (userId: string) => {
        console.log(`Friend request from user: ${socket.user?.id} to user: ${userId}`);
        
        const recipientSocket = this.userSockets.get(userId);
        if (recipientSocket) {
          this.io.to(recipientSocket).emit('new_friend_request', {
            sender: socket.user,
            timestamp: new Date()
          });
          console.log(`Friend request sent to user: ${userId}`);
          
        }
      });

      socket.on('friend_request_response', ({ userId, status }: { userId: string; status: 'accepted' | 'rejected' }) => {
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
      socket.on('set_status', (status: 'online' | 'away') => {
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

  private async updateUserStatus(userId: string, status: 'online' | 'offline' | 'away', lastSeen?: Date): Promise<void> {
    this.userStatus.set(userId, {
      userId,
      status,
      lastSeen
    });
  try {
   const updateUserStates = await User.updateOne(
      { _id: userId },
      { userStatus: status, lastSeen }
    );
    console.log(`Updated user status for ${userId}:`, updateUserStates);
    
  } catch (error) {
    console.error(`Failed to update status for user ${userId}:`, error);
  }
  }

  private broadcastUserStatus(userId: string, status: 'online' | 'offline' | 'away') {
    // Notify friends about status change
    this.io.emit('user_status_changed', {
      userId,
      status,
      timestamp: new Date()
    });
  }

  // Public methods for external use
  public emitToUser(userId: string, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    console.log('Emitting to user:', userId, 'Event:', event, 'Data:', data);
    console.log('Socket ID:', socketId);
    
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  public emitToChat(chatId: string, event: string, data: any) {
    this.io.to(chatId).emit(event, data);
  }

  public broadcastEvent(event: string, data: any) {
    this.io.emit(event, data);
  }

  public getUserStatus(userId: string): OnlineStatus | undefined {
    return this.userStatus.get(userId);
  }

  public isUserOnline(userId: string): boolean {
    const status = this.userStatus.get(userId);
    return status?.status === 'online';
  }
}
