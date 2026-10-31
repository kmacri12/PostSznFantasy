import axios from "axios";
import { supabaseAuth } from "../utils/supabase";

// An empty base keeps requests same-origin so the Vite dev proxy can forward /api.
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "" });

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
