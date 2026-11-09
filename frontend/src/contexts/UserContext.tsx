import type { Session, User as SupabaseUser } from "@supabase/auth-js";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
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
import { markNameSkipped, nameProblem, nameSkipped, providerName } from "../utils/displayName";
import { createLogger } from "../utils/logger";
import { forgetThisDevice, refreshPushSubscription } from "../utils/pushSetup";
import { supabaseAuth } from "../utils/supabase";

const logger = createLogger("UserContext");

interface UserContextType {
  user: SupabaseUser | null;
  userId: number | null;
  /** The name other members see (the API's, not the sign-in provider's), once known. */
  username: string | null;
  /** First sign-in or still no name chosen: show "What should we call you?". */
  needsNameSetup: boolean;
  skipNameSetup: () => void;
  /** The signed-in member's profile picture path, if they set one. */
  avatarUrl: string | null;
  setAvatarUrl: (avatarUrl: string | null) => void;
  loading: boolean;
  /** True after Supabase ends the session without the user asking (refresh failed, other tab). */
  sessionExpired: boolean;
  /** Set when the backend login sync fails, so the UI can say why nothing loads. */
  syncError: string | null;
  /** Opens the sign-in screen and returns here afterwards. */
  signIn: () => void;
  signInWithGoogle: (next: string) => Promise<string | null>;
  /** Emails a one-time code; resolves to an error message, or null when the email went out. */
  sendEmailCode: (email: string) => Promise<string | null>;
  /** Checks the emailed code; resolves to an error message, or null once signed in. */
  verifyEmailCode: (email: string, code: string) => Promise<string | null>;
  /** Renames the signed-in user everywhere; resolves to an error message, or null once saved. */
  updateDisplayName: (name: string) => Promise<string | null>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const UNREACHABLE_MESSAGE =
  "Couldn't reach the server to finish signing you in. Reload to try again.";

/** The server's own explanation for a 4xx; the generic text only for network errors and 5xx. */
const loginErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    if (status && status < 500 && typeof detail === "string" && detail) return detail;
  }
  return UNREACHABLE_MESSAGE;
};

const sendCodeErrorMessage = (error: { status?: number; code?: string }): string =>
  error.status === 429 || error.code === "over_email_send_rate_limit"
    ? "Too many emails sent. Wait a minute and try again."
    : "Couldn't send the sign-in code. Check the address and try again.";

const verifyCodeErrorMessage = (error: { status?: number; code?: string }): string =>
  error.status === 429
    ? "Too many attempts. Wait a few minutes and try again."
    : error.code === "otp_expired"
      ? "That code is wrong or has expired. Check it or request a new one."
      : "Couldn't verify the code. Try again.";

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [namePrompt, setNamePrompt] = useState(false);
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
    supabaseAuth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((err) => logger.error("Error checking Supabase session:", err))
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabaseAuth.onAuthStateChange((_event, nextSession) => {
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
      setUsername(null);
      setNamePrompt(false);
      setAvatarUrl(null);
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
      .post<{
        userId: number;
        avatarUrl?: string | null;
        username: string;
        namePrompt: boolean;
      }>("/api/auth/login", { username: providerName(user) })
      .then((response) => {
        if (cancelled) return;
        setUserId(response.data.userId);
        setUsername(response.data.username);
        setNamePrompt(response.data.namePrompt && !nameSkipped(user.id));
        setAvatarUrl(response.data.avatarUrl ?? null);
        setSyncError(null);
        void refreshPushSubscription();
      })
      .catch((error) => {
        if (cancelled) return;
        logger.error("Error syncing user with backend:", error);
        setSyncError(loginErrorMessage(error));
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
    const { error } = await supabaseAuth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl(window.location.origin, next) },
    });
    if (error) logger.error("Error signing in with Google:", error);
    return error ? "Couldn't start Google sign-in. Try again." : null;
  }, []);

  const sendEmailCode = useCallback(async (email: string) => {
    const { error } = await supabaseAuth.signInWithOtp({ email });
    if (error) logger.error("Error sending sign-in code:", error);
    return error ? sendCodeErrorMessage(error) : null;
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabaseAuth.verifyOtp({ email, token: code, type: "email" });
    if (error) logger.warn("Error verifying sign-in code:", error);
    return error ? verifyCodeErrorMessage(error) : null;
  }, []);

  const signOutUser = useCallback(async () => {
    deliberateSignOut.current = true;
    // Needs the session's token, so it runs before the session ends.
    await forgetThisDevice();
    try {
      await supabaseAuth.signOut();
    } catch (error) {
      deliberateSignOut.current = false;
      logger.error("Error signing out:", error);
    }
    navigate("/");
  }, [navigate]);

  // The login sync above resends the Supabase name on every sign-in, so the name has to change
  // there too or the next sign-in would overwrite it.
  const updateDisplayName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      const problem = nameProblem(trimmed);
      if (problem) return problem;
      try {
        await api.patch("/api/auth/me", { username: trimmed });
      } catch (syncError) {
        logger.error("Error saving the display name:", syncError);
        return loginErrorMessage(syncError) === UNREACHABLE_MESSAGE
          ? "Couldn't save your name. Try again."
          : loginErrorMessage(syncError);
      }
      // Kept in the provider profile too, so the Google name never contradicts it.
      const { error } = await supabaseAuth.updateUser({ data: { full_name: trimmed } });
      if (error) logger.warn("Error updating the provider name:", error);
      setUsername(trimmed);
      setNamePrompt(false);
      await queryClient.invalidateQueries();
      return null;
    },
    [queryClient],
  );

  const skipNameSetup = useCallback(() => {
    if (user) markNameSkipped(user.id);
    setNamePrompt(false);
  }, [user]);

  const getIdToken = useCallback(async () => {
    const {
      data: { session: current },
    } = await supabaseAuth.getSession();
    return current?.access_token ?? null;
  }, []);

  const value = useMemo(
    () => ({
      user,
      userId,
      username,
      needsNameSetup: namePrompt,
      skipNameSetup,
      avatarUrl,
      setAvatarUrl,
      loading,
      sessionExpired,
      syncError,
      signIn,
      signInWithGoogle,
      sendEmailCode,
      verifyEmailCode,
      updateDisplayName,
      signOutUser,
      getIdToken,
    }),
    [
      user,
      userId,
      username,
      namePrompt,
      skipNameSetup,
      avatarUrl,
      loading,
      sessionExpired,
      syncError,
      signIn,
      signInWithGoogle,
      sendEmailCode,
      verifyEmailCode,
      updateDisplayName,
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

/** The signed-in member's display name, or null; safe outside a provider (header tests). */
export const useUsername = (): string | null => useContext(UserContext)?.username ?? null;

/** The signed-in member's picture path, or null; safe outside a provider (header tests). */
export const useUserAvatar = (): string | null => useContext(UserContext)?.avatarUrl ?? null;
