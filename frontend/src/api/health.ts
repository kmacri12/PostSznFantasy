import { useQuery } from "@tanstack/react-query";

export type ApiHealth = "checking" | "up" | "down";

const RECHECK_WHILE_DOWN_MS = 30_000;
const TIMEOUT_MS = 5_000;

// Plain fetch, not the axios client: the health check must not depend on auth, and a
// 4xx still proves the API is answering. Only no answer or a 5xx counts as down.
const checkHealth = async (signal: AbortSignal): Promise<true> => {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  if (response.status >= 500) throw new Error(`API unhealthy: ${response.status}`);
  return true;
};

export const useApiHealth = (): ApiHealth => {
  const { isPending, isError } = useQuery({
    queryKey: ["api-health"],
    queryFn: ({ signal }) => checkHealth(signal),
    retry: 1,
    retryDelay: 500,
    refetchInterval: (query) => (query.state.status === "error" ? RECHECK_WHILE_DOWN_MS : false),
  });
  if (isError) return "down";
  return isPending ? "checking" : "up";
};
