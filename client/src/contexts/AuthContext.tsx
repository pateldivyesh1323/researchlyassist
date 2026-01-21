import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import api from '@/lib/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface AppUser {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
}

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: User | null;
  token: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const authInProgress = useRef(false);

  const authenticateWithBackend = useCallback(async (firebaseUser: User) => {
    if (authInProgress.current) return;
    authInProgress.current = true;

    try {
      const firebaseToken = await firebaseUser.getIdToken();
      
      const response = await api.post('/auth/authenticate', {
        firebaseToken,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      });

      const data = response.data;
      
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      console.error('Backend authentication error:', error);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
      throw new Error('Failed to connect to server. Please try again.');
    } finally {
      authInProgress.current = false;
    }
  }, []);

  const verifyStoredToken = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    
    if (!storedToken) {
      setLoading(false);
      return false;
    }

    try {
      const response = await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });

      const data = response.data;
      setUser(data.user);
      setToken(storedToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return true;
    } catch (error) {
      console.error('Token verification error:', error);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const tokenValid = await verifyStoredToken();
      
      if (tokenValid && mounted) {
        setLoading(false);
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!mounted) return;
        
        setFirebaseUser(firebaseUser);
        
        if (firebaseUser) {
          const currentToken = localStorage.getItem(TOKEN_KEY);
          if (!currentToken) {
            await authenticateWithBackend(firebaseUser);
          }
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
        
        setLoading(false);
      });

      return unsubscribe;
    };

    const unsubscribePromise = initAuth();

    return () => {
      mounted = false;
      unsubscribePromise.then((unsubscribe) => unsubscribe?.());
    };
  }, [authenticateWithBackend, verifyStoredToken]);

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await authenticateWithBackend(result.user);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await authenticateWithBackend(result.user);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await authenticateWithBackend(result.user);
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        token,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
