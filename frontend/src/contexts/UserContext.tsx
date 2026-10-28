import type { User as SupabaseUser } from "@supabase/supabase-js";
import axios from "axios";
import type React from "react";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

interface UserContextType {
  user: SupabaseUser | null;
  userId: number | null;
  idToken: string | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL;

  const syncUserWithBackend = async (supabaseUser: SupabaseUser, token: string) => {
    try {
      setIdToken(token);
      const email = supabaseUser.email;
      const username =
        (supabaseUser.user_metadata?.full_name as string | undefined) ||
        (supabaseUser.user_metadata?.name as string | undefined) ||
        email?.split("@")[0] ||
        "User";

      const response = await axios.post(
        `${apiUrl}/api/auth/login`,
        {
          email,
          username,
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
    // 1. Initial session retrieval
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user && session?.access_token) {
          setUser(session.user);
          await syncUserWithBackend(session.user, session.access_token);
        } else {
          setUser(null);
          setUserId(null);
          setIdToken(null);
        }
      } catch (err) {
        console.error("Error checking Supabase session:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // 2. Auth state subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user && session?.access_token) {
        setUser(session.user);
        await syncUserWithBackend(session.user, session.access_token);
      } else {
        setUser(null);
        setUserId(null);
        setIdToken(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const signOutUser = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserId(null);
      setIdToken(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getIdToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token || null;
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
