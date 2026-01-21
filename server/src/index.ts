import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import paperRoutes from './routes/papers.js';
import notesRoutes from './routes/notes.js';
import authRoutes from './routes/auth.js';
import { initializeFirebaseAdmin } from './config/firebase.js';
import { initializeCloudinary } from './config/cloudinary.js';
import { loggerMiddleware } from './middleware/logger.js';
import { initializeWebSocket } from './websocket/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 8000;

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(loggerMiddleware);

initializeFirebaseAdmin();
initializeCloudinary();
initializeWebSocket(httpServer);

app.use('/api/auth', authRoutes);
app.use('/api/papers', paperRoutes);
app.use('/api/notes', notesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Researchly Assist API is running' });
});

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/researchly-assist')
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });
