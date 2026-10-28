import axios from "axios";
import type { User as FirebaseUser } from "firebase/auth";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import type React from "react";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";
import { auth } from "../components/auth/firebase";

interface UserContextType {
  user: FirebaseUser | null;
  userId: number | null;
  idToken: string | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL;

  const syncUserWithBackend = async (firebaseUser: FirebaseUser) => {
    try {
      const token = await firebaseUser.getIdToken();
      setIdToken(token);
      const response = await axios.post(
        `${apiUrl}/api/auth/login`,
        {
          email: firebaseUser.email,
          username: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (response.data?.userId) {
        setUserId(response.data.userId);
      } else if (response.data?.user_id) {
        setUserId(response.data.user_id);
      }
    } catch (error) {
      console.error("Error syncing user with backend:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await syncUserWithBackend(currentUser);
      } else {
        setUserId(null);
        setIdToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [apiUrl]);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      await syncUserWithBackend(result.user);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserId(null);
      setIdToken(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getIdToken = async () => {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken();
    setIdToken(token);
    return token;
  };

  return (
    <UserContext.Provider
      value={{
        user,
        userId,
        idToken,
        loading,
        signIn,
        signOutUser,
        getIdToken,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
