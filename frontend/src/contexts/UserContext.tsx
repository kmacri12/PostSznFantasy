import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import type React from "react";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../api/client";
import { createLogger } from "../utils/logger";
import { supabase } from "../utils/supabase";

const logger = createLogger("UserContext");

interface UserContextType {
  user: SupabaseUser | null;
  userId: number | null;
  loading: boolean;
  /** Set when the backend login sync fails, so the UI can say why nothing loads. */
  syncError: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const displayName = (user: SupabaseUser): string =>
  (user.user_metadata?.full_name as string | undefined) ||
  (user.user_metadata?.name as string | undefined) ||
  user.email?.split("@")[0] ||
  "User";

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const user = session?.user ?? null;
  const supabaseUid = user?.id ?? null;

  // The listener only records the session: awaiting Supabase or backend calls inside
  // it can deadlock the auth client.
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((err) => logger.error("Error checking Supabase session:", err))
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Keyed on the Supabase uid, so token refreshes do not re-post /auth/login.
  // biome-ignore lint/correctness/useExhaustiveDependencies: user fields are read once per uid
  useEffect(() => {
    if (!user) {
      setUserId(null);
      setSyncError(null);
      return;
    }
    let cancelled = false;
    api
      .post<{ userId: number }>("/api/auth/login", {
        email: user.email,
        username: displayName(user).slice(0, 20),
      })
      .then((response) => {
        if (cancelled) return;
        setUserId(response.data.userId);
        setSyncError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        logger.error("Error syncing user with backend:", error);
        setSyncError("Could not reach the server to finish signing you in.");
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseUid]);

  const signIn = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (error) {
      logger.error("Error signing in with Google:", error);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logger.error("Error signing out:", error);
    }
  }, []);

  const getIdToken = useCallback(async () => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession();
    return current?.access_token ?? null;
  }, []);

  const value = useMemo(
    () => ({ user, userId, loading, syncError, signIn, signOutUser, getIdToken }),
    [user, userId, loading, syncError, signIn, signOutUser, getIdToken],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
