import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN_KEY = 'auth_token';

class SocketManager {
  private socket: TypedSocket | null = null;
  private connectionPromise: Promise<TypedSocket> | null = null;

  connect(): Promise<TypedSocket> {
    if (this.socket?.connected) {
      return Promise.resolve(this.socket);
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        this.connectionPromise = null;
        reject(new Error('No auth token'));
        return;
      }

      const serverUrl = import.meta.env.VITE_SERVER_URL || undefined;
      console.log('[Socket] Connecting to:', serverUrl || 'same origin');
      
      this.socket = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
      }) as TypedSocket;

      this.socket.on('connect', () => {
        this.connectionPromise = null;
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        this.connectionPromise = null;
        reject(error);
      });
    });

    return this.connectionPromise;
  }

  getSocket(): TypedSocket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionPromise = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketManager = new SocketManager();

export type { TypedSocket };
