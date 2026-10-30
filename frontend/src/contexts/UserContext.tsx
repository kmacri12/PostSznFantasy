import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { authCallbackUrl, signInPath } from "../utils/authRedirect";
import { createLogger } from "../utils/logger";
import { supabase } from "../utils/supabase";

const logger = createLogger("UserContext");

interface UserContextType {
  user: SupabaseUser | null;
  userId: number | null;
  loading: boolean;
  /** True after Supabase ends the session without the user asking (refresh failed, other tab). */
  sessionExpired: boolean;
  /** Set when the backend login sync fails, so the UI can say why nothing loads. */
  syncError: string | null;
  /** Opens the sign-in screen and returns here afterwards. */
  signIn: () => void;
  signInWithGoogle: (next: string) => Promise<string | null>;
  /** Sends a magic link; resolves to an error message, or null when the email went out. */
  signInWithEmail: (email: string, next: string) => Promise<string | null>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const displayName = (user: SupabaseUser): string =>
  (user.user_metadata?.full_name as string | undefined) ||
  (user.user_metadata?.name as string | undefined) ||
  user.email?.split("@")[0] ||
  "User";

const magicLinkErrorMessage = (error: { status?: number; code?: string }): string =>
  error.status === 429 || error.code === "over_email_send_rate_limit"
    ? "Too many emails sent. Wait a minute and try again."
    : "Couldn't send the sign-in link. Check the address and try again.";

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const deliberateSignOut = useRef(false);
  const hadUser = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

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
      if (hadUser.current) {
        hadUser.current = false;
        queryClient.clear();
        setSessionExpired(!deliberateSignOut.current);
        deliberateSignOut.current = false;
      }
      return;
    }
    hadUser.current = true;
    setSessionExpired(false);
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
        setSyncError("Couldn't reach the server to finish signing you in. Reload to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseUid]);

  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const signIn = useCallback(() => {
    if (!location.pathname.startsWith("/sign-in")) navigate(signInPath(currentPath));
  }, [navigate, location.pathname, currentPath]);

  const signInWithGoogle = useCallback(async (next: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl(window.location.origin, next) },
    });
    if (error) logger.error("Error signing in with Google:", error);
    return error ? "Couldn't start Google sign-in. Try again." : null;
  }, []);

  const signInWithEmail = useCallback(async (email: string, next: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl(window.location.origin, next) },
    });
    if (error) logger.error("Error sending magic link:", error);
    return error ? magicLinkErrorMessage(error) : null;
  }, []);

  const signOutUser = useCallback(async () => {
    deliberateSignOut.current = true;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      deliberateSignOut.current = false;
      logger.error("Error signing out:", error);
    }
    navigate("/");
  }, [navigate]);

  const getIdToken = useCallback(async () => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession();
    return current?.access_token ?? null;
  }, []);

  const value = useMemo(
    () => ({
      user,
      userId,
      loading,
      sessionExpired,
      syncError,
      signIn,
      signInWithGoogle,
      signInWithEmail,
      signOutUser,
      getIdToken,
    }),
    [
      user,
      userId,
      loading,
      sessionExpired,
      syncError,
      signIn,
      signInWithGoogle,
      signInWithEmail,
      signOutUser,
      getIdToken,
    ],
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
