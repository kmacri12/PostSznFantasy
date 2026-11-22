/** Only hides admin controls: the server enforces who may call /api/admin/*. */
export const isAdminHint = (userId: string | undefined): boolean =>
  !!userId &&
  (import.meta.env.VITE_ADMIN_SUPABASE_UIDS ?? "")
    .split(",")
    .map((id: string) => id.trim())
    .includes(userId);
