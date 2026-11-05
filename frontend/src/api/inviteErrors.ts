/** The join route's 409 for a league with no open team (`code: "league_full"`). */
export const isLeagueFullError = (error: unknown): boolean => {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | null)
    ?.response;
  return response?.status === 409 && response.data?.code === "league_full";
};
