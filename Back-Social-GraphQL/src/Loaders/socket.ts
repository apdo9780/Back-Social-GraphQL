import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { Server as HttpServer } from 'http';
import { GraphQLSchema } from 'graphql';
import { Context } from 'graphql-ws'; // استيراد الـ Type الأساسي
import { getTokenFromConnectionParams, getUserFromJwt } from '../auth/auth-context';
import { updateUserStatus } from '../services/user-status.service';
import type { GraphQLContext } from '../types/context';

const connectionUsers = new Map<string, any>();

export default ({ httpServer, schema }: { httpServer: HttpServer, schema: GraphQLSchema }) => {
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql'
  });

  useServer(
    {
      schema,
      onConnect: async (ctx: Context) => {
        const token = getTokenFromConnectionParams(ctx.connectionParams);
        if (!token) return true;

        const user = await getUserFromJwt(token);
        if (user?._id) {
          const socketId = (ctx.extra as any).socket.id; 
          connectionUsers.set(socketId, user);
          await updateUserStatus(user._id.toString(), 'online');
        }
        return true;
      },
      context: async (ctx: Context): Promise<GraphQLContext> => {
        const socketId = (ctx.extra as any).socket.id;
        const user = connectionUsers.get(socketId) || null;
        return { user };
      },
      onDisconnect: async (ctx: Context) => {
        const socketId = (ctx.extra as any).socket.id;
        const user = connectionUsers.get(socketId);
        if (user?._id) {
          await updateUserStatus(user._id.toString(), 'offline');
          connectionUsers.delete(socketId);
        }
      }
    },
    wsServer
  );

  console.log('WebSockets server loaded');
};