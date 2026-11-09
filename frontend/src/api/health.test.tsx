import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isDormant, useApiHealth } from "./health";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const respondWith = (status: number) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status }));

afterEach(() => vi.restoreAllMocks());

describe("useApiHealth", () => {
  it("starts out checking, then reports up for a healthy API", async () => {
    respondWith(200);
    const { result } = renderHook(() => useApiHealth(), { wrapper });
    expect(result.current).toBe("checking");
    await waitFor(() => expect(result.current).toBe("up"));
  });

  it("reports down when the API is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useApiHealth(), { wrapper });
    await waitFor(() => expect(result.current).toBe("down"), { timeout: 4000 });
  });

  it("reports down on a 5xx, such as the database being unavailable", async () => {
    respondWith(503);
    const { result } = renderHook(() => useApiHealth(), { wrapper });
    await waitFor(() => expect(result.current).toBe("down"), { timeout: 4000 });
  });

  it("does not treat a 4xx as down", async () => {
    respondWith(401);
    const { result } = renderHook(() => useApiHealth(), { wrapper });
    await waitFor(() => expect(result.current).toBe("up"));
  });
});

describe("isDormant", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless the build says VITE_DORMANT=true", () => {
    expect(isDormant()).toBe(false);
    vi.stubEnv("VITE_DORMANT", "true");
    expect(isDormant()).toBe(true);
  });
});
