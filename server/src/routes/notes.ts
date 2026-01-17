import { Router, Response } from 'express';
import { Note } from '../models/Note.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/:paperId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let note = await Note.findOne({ 
      paperId: req.params.paperId, 
      userId: req.user!.userId 
    });
    
    if (!note) {
      note = new Note({
        userId: req.user!.userId,
        paperId: req.params.paperId,
        content: '',
      });
      await note.save();
    }
    
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.put('/:paperId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;
    
    const note = await Note.findOneAndUpdate(
      { paperId: req.params.paperId, userId: req.user!.userId },
      { content, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

export default router;
