import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import paperRoutes from './routes/papers.js';
import aiRoutes from './routes/ai.js';
import notesRoutes from './routes/notes.js';
import { initializeFirebaseAdmin } from './config/firebase.js';
import { initializeCloudinary } from './config/cloudinary.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

initializeFirebaseAdmin();
initializeCloudinary();

app.use('/api/papers', paperRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notes', notesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Researchly Assist API is running' });
});

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/researchly-assist')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });
