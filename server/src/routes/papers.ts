import { Router, Response } from 'express';
import { Paper } from '../models/Paper.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.default || pdfParseModule;

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const papers = await Paper.find({ userId: req.user!.uid }).sort({ uploadedAt: -1 });
    res.json(papers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch papers' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user!.uid });
    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }
    res.json(paper);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch paper' });
  }
});

router.post('/upload', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, fileName, fileBase64 } = req.body;
    
    if (!title || !fileName || !fileBase64) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    
    let textContent = '';
    try {
      const pdfData = await pdfParse(buffer);
      textContent = pdfData.text;
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
    }

    const folder = `researchly-assist/papers/${req.user!.uid}`;
    const uniqueFileName = `${Date.now()}_${fileName.replace(/\.[^/.]+$/, '')}`;
    const { url: fileUrl, publicId: storagePath } = await uploadToCloudinary(buffer, folder, uniqueFileName);

    const paper = new Paper({
      userId: req.user!.uid,
      title,
      fileName,
      fileUrl,
      storagePath,
      textContent,
    });

    await paper.save();
    res.status(201).json(paper);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload paper' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paper = await Paper.findOne({ _id: req.params.id, userId: req.user!.uid });
    
    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }

    try {
      await deleteFromCloudinary(paper.storagePath);
    } catch (storageError) {
      console.error('Storage delete error:', storageError);
    }

    await Paper.deleteOne({ _id: req.params.id });
    res.json({ message: 'Paper deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete paper' });
  }
});

export default router;
