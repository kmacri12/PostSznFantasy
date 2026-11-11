import axios from "axios";
import { BUILD_TIME } from "../utils/appVersion";
import { cachedAtOf, recordFresh } from "../utils/dataFreshness";
import { supabaseAuth } from "../utils/supabase";
import { isOutdatedCode, signalAppOutdated } from "./appOutdated";
import { recordFailedRequest } from "./failedRequests";

export const OFFLINE_WRITE_REASON = "You're offline. Changes are turned off until you're back.";

// An empty base keeps requests same-origin so the Vite dev proxy can forward /api.
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "" });

const READ_METHODS = new Set(["get", "head", "options"]);

// While the device has no connection every write is refused up front with a readable reason,
// instead of failing slowly or waiting in a queue the member can't see.
api.interceptors.request.use((config) => {
  if (BUILD_TIME > 0) config.headers["X-App-Version"] = String(BUILD_TIME);
  if (navigator.onLine === false && !READ_METHODS.has((config.method ?? "get").toLowerCase())) {
    return Promise.reject(
      Object.assign(new Error(OFFLINE_WRITE_REASON), {
        config,
        isAxiosError: true,
        response: { status: 0, data: { detail: OFFLINE_WRITE_REASON }, headers: {} },
      }),
    );
  }
  return config;
});

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabaseAuth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// A token can expire between the refresh timer and a request (sleeping phone, long
// draft). One refresh-and-retry keeps that invisible; if the refresh itself fails,
// Supabase emits SIGNED_OUT and UserContext shows the session-expired banner.
api.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  if (error.response?.status !== 401 || !config || config.retriedAfterRefresh) throw error;
  const { data } = await supabaseAuth.refreshSession();
  if (!data.session) throw error;
  config.retriedAfterRefresh = true;
  return api.request(config);
});

// After the refresh interceptor, so a request it retries successfully is never recorded.
api.interceptors.response.use(undefined, (error) => {
  recordFailedRequest(error);
  throw error;
});

// An answer, live or replayed from the service worker's cache, dates the data on screen.
api.interceptors.response.use((response) => {
  if ((response.config.method ?? "get").toLowerCase() === "get") {
    recordFresh(cachedAtOf(response.headers) ?? Date.now());
  }
  return response;
});

api.interceptors.response.use(undefined, (error) => {
  if (isOutdatedCode(error)) signalAppOutdated();
  throw error;
});
