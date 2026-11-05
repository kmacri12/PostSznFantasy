import { scrubUrl } from "../utils/sentry";

export interface FailedRequest {
  time: string;
  method: string;
  path: string;
  /** 0 when no response arrived (offline, timeout). */
  status: number;
  /** The API's `X-Request-ID`, so support can find the server log line. */
  requestId: string | null;
}

// Method, path, status and id only: never a body, a header value or a query string.
const MAX_FAILED_REQUESTS = 10;
const failed: FailedRequest[] = [];

interface RequestFailure {
  config?: { method?: string; url?: string };
  response?: { status?: number; headers?: Record<string, unknown> };
}

export const recordFailedRequest = (error: unknown): void => {
  const { config, response } = (error ?? {}) as RequestFailure;
  if (!config) return;
  const requestId = response?.headers?.["x-request-id"];
  failed.push({
    time: new Date().toISOString(),
    method: (config.method ?? "get").toUpperCase(),
    path: scrubUrl(config.url ?? ""),
    status: response?.status ?? 0,
    requestId: typeof requestId === "string" ? requestId : null,
  });
  if (failed.length > MAX_FAILED_REQUESTS) failed.shift();
};

export const recentFailedRequests = (): FailedRequest[] => failed.map((entry) => ({ ...entry }));

export const clearFailedRequests = (): void => {
  failed.length = 0;
};
