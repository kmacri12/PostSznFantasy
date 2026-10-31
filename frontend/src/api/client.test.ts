import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock("../utils/supabase", () => ({
  supabaseAuth: { getSession: mocks.getSession, refreshSession: mocks.refreshSession },
}));

import { api } from "./client";

const respond = (config: InternalAxiosRequestConfig, status: number): Promise<AxiosResponse> => {
  const response = { data: {}, status, statusText: "", headers: {}, config } as AxiosResponse;
  if (status < 400) return Promise.resolve(response);
  return Promise.reject(new AxiosError("fail", String(status), config, null, response));
};

let seenTokens: (string | undefined)[];

const useAdapter = (statusFor: (token: string | undefined) => number) => {
  const adapter: AxiosAdapter = (config) => {
    const token = String(config.headers.Authorization ?? "").replace("Bearer ", "") || undefined;
    seenTokens.push(token);
    return respond(config, statusFor(token));
  };
  api.defaults.adapter = adapter;
};

beforeEach(() => {
  seenTokens = [];
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "old" } } });
  mocks.refreshSession.mockReset();
});

describe("api client", () => {
  it("retries once with a refreshed token after a 401", async () => {
    mocks.refreshSession.mockImplementation(async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { access_token: "new" } } });
      return { data: { session: { access_token: "new" } } };
    });
    useAdapter((token) => (token === "new" ? 200 : 401));

    const response = await api.get("/api/x");

    expect(response.status).toBe(200);
    expect(seenTokens).toEqual(["old", "new"]);
  });

  it("gives up when the session cannot be refreshed", async () => {
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("gone") });
    useAdapter(() => 401);

    await expect(api.get("/api/x")).rejects.toMatchObject({ response: { status: 401 } });
    expect(seenTokens).toEqual(["old"]);
  });

  it("does not loop when the refreshed token is also rejected", async () => {
    mocks.refreshSession.mockResolvedValue({ data: { session: { access_token: "new" } } });
    useAdapter(() => 401);

    await expect(api.get("/api/x")).rejects.toMatchObject({ response: { status: 401 } });
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("leaves other errors alone", async () => {
    useAdapter(() => 500);
    await expect(api.get("/api/x")).rejects.toMatchObject({ response: { status: 500 } });
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });
});
