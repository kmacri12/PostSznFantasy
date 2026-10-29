import axios from "axios";
import { supabase } from "../utils/supabase";

// An empty base keeps requests same-origin so the Vite dev proxy can forward /api.
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "" });

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
