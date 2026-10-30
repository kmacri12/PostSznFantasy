import type { ErrorEvent } from "@sentry/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));
vi.mock("@sentry/react", () => sdk);

const load = async () => {
  vi.resetModules();
  return import("./sentry");
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("without VITE_SENTRY_DSN", () => {
  it("is inert: init loads nothing and every call is a no-op", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    const sentry = await load();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    sentry.initSentry();
    sentry.captureError(new Error("boom"));
    sentry.addBreadcrumb("draft.connection", "connected");
    await flush();

    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
    expect(sdk.addBreadcrumb).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("with VITE_SENTRY_DSN", () => {
  it("initialises once with the environment, no PII and no tracing", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://key@o1.ingest.sentry.io/1");
    vi.stubEnv("VITE_SENTRY_ENVIRONMENT", "production");
    const sentry = await load();

    sentry.initSentry();
    sentry.initSentry();
    await flush();

    expect(sdk.init).toHaveBeenCalledTimes(1);
    const options = sdk.init.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      dsn: "https://key@o1.ingest.sentry.io/1",
      environment: "production",
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false },
    });
    expect(options?.tracesSampleRate).toBeUndefined();
  });

  it("forwards errors and breadcrumbs after init", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://key@o1.ingest.sentry.io/1");
    const sentry = await load();
    sentry.initSentry();
    const error = new Error("boom");

    sentry.captureError(error, { scope: "x" });
    sentry.addBreadcrumb("draft.connection", "reconnecting", { attempt: 2 });
    await flush();

    expect(sdk.captureException).toHaveBeenCalledWith(error, { extra: { scope: "x" } });
    expect(sdk.addBreadcrumb).toHaveBeenCalledWith({
      category: "draft.connection",
      message: "reconnecting",
      level: "info",
      data: { attempt: 2 },
    });
  });
});

describe("scrubUrl", () => {
  it("hides invite codes and drops query and hash", async () => {
    const { scrubUrl } = await load();
    expect(scrubUrl("https://postsznfantasy.com/join/ABC123?ref=x#access_token=eyJ")).toBe(
      "https://postsznfantasy.com/join/[code]",
    );
    expect(scrubUrl("https://api.postsznfantasy.com/api/invites/ABC123/join")).toBe(
      "https://api.postsznfantasy.com/api/invites/[code]/join",
    );
    expect(scrubUrl("/league/4/draft")).toBe("/league/4/draft");
  });
});

describe("scrubEvent", () => {
  it("removes user, cookies, auth headers and scrubs emails and tokens", async () => {
    const { scrubEvent } = await load();
    const event = {
      user: { email: "a@b.com", id: "1", ip_address: "1.2.3.4" },
      request: {
        url: "https://postsznfantasy.com/join/SECRET?x=1",
        query_string: "x=1",
        cookies: { sb: "1" },
        headers: { Authorization: "Bearer abc", cookie: "sb=1", Accept: "*/*" },
      },
      message: "failed for kyle@example.com",
      exception: { values: [{ value: "bad eyJhbGciOi.eyJzdWIiOi.sig token" }] },
      breadcrumbs: [
        { category: "fetch", data: { url: "https://api/api/invites/CODE/join?x=1" } },
        { category: "console", message: "hello" },
      ],
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);

    expect(out.user).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.query_string).toBeUndefined();
    expect(out.request?.headers).toEqual({ Accept: "*/*" });
    expect(out.request?.url).toBe("https://postsznfantasy.com/join/[code]");
    expect(out.message).toBe("failed for [email]");
    expect(out.exception?.values?.[0]?.value).toBe("bad [token] token");
    expect(out.breadcrumbs?.[0]?.data?.url).toBe("https://api/api/invites/[code]/join");
  });
});
