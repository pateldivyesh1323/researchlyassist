import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../config/firebase.js';
import { User } from '../models/User.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

interface AuthenticateBody {
  firebaseToken: string;
  displayName?: string;
  photoURL?: string;
}

router.post('/authenticate', async (req: Request<{}, {}, AuthenticateBody>, res: Response): Promise<void> => {
  try {
    const { firebaseToken, displayName, photoURL } = req.body;

    if (!firebaseToken) {
      res.status(400).json({ error: 'Firebase token is required' });
      return;
    }

    const decodedToken = await verifyToken(firebaseToken);
    const { uid, email } = decodedToken;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    let user = await User.findOne({ firebaseUid: uid });
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email,
        displayName: displayName || decodedToken.name,
        photoURL: photoURL || decodedToken.picture,
      });
      isNewUser = true;
    } else {
      user.lastLoginAt = new Date();
      if (displayName) user.displayName = displayName;
      if (photoURL) user.photoURL = photoURL;
      await user.save();
    }

    const token = jwt.sign(
      {
        userId: user._id,
        firebaseUid: uid,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
      },
      isNewUser,
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      firebaseUid: string;
      email: string;
    };

    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

export default router;
