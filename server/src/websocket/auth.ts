import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { AuthenticatedSocket, AuthenticatedUser } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authenticateSocket = (
  socket: Socket,
  next: (err?: Error) => void
): void => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;

    (socket as AuthenticatedSocket).user = {
      userId: decoded.userId,
      firebaseUid: decoded.firebaseUid,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid token'));
    }
    next(new Error('Authentication failed'));
  }
};
