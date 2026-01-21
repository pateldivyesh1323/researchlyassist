import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { authenticateSocket } from './auth.js';
import { registerNotesHandlers } from './handlers/notes.js';
import { registerAIHandlers } from './handlers/ai.js';
import {
  AuthenticatedSocket,
  ClientToServerEvents,
  ServerToClientEvents,
} from './types.js';

export const initializeWebSocket = (httpServer: HttpServer): Server => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:5173', 'http://localhost:3000'];

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;
    console.log(`User connected: ${authenticatedSocket.user.userId}`);

    registerNotesHandlers(authenticatedSocket);
    registerAIHandlers(authenticatedSocket);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${authenticatedSocket.user.userId}`);
    });
  });

  return io;
};

export * from './types.js';
