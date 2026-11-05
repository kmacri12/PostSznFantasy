import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFailedRequests, recordFailedRequest } from "../api/failedRequests";
import { collectDiagnostics, describeDiagnostics } from "./diagnostics";
import { clearLogBuffer, createLogger, recentLogEntries } from "./logger";

vi.mock("./sentry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sentry")>()),
  captureError: vi.fn(),
  latestSentryEventId: () => "evt-123",
}));

const TOKEN = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";
const context = {
  pathname: "/join/SECRETCODE",
  apiVersion: "abcdef1234",
  leagueId: 3,
  seasonId: 5,
  teamId: 7,
};

beforeEach(() => {
  clearLogBuffer();
  clearFailedRequests();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("the log buffer", () => {
  it("keeps the last 50 entries", () => {
    const log = createLogger("Test");
    for (let i = 0; i < 60; i++) log.info(`line ${i}`);
    const entries = recentLogEntries();
    expect(entries).toHaveLength(50);
    expect(entries[0]?.message).toBe("line 10");
    expect(entries.at(-1)?.message).toBe("line 59");
  });

  it("keeps levels the console hides and scrubs tokens and addresses", () => {
    createLogger("Auth").debug(`refresh failed for kyle@example.org with Bearer ${TOKEN}`);
    const [entry] = recentLogEntries();
    expect(entry?.level).toBe("DEBUG");
    expect(entry?.message).toBe("refresh failed for [email] with Bearer [token]");
  });

  it("never stores context objects", () => {
    createLogger("Chat").warn("Send failed", { body: "private chat text" });
    expect(JSON.stringify(recentLogEntries())).not.toContain("private chat text");
  });
});

describe("failed requests", () => {
  it("records method, path, status and request id, nothing else", () => {
    recordFailedRequest({
      config: {
        method: "post",
        url: "/api/seasons/5/messages?token=abc",
        data: '{"body":"private chat text"}',
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
      response: { status: 500, headers: { "x-request-id": "req-1" }, data: { detail: "x" } },
    });
    expect(JSON.stringify(collectDiagnostics(context).failedRequests)).toMatch(
      /"method":"POST","path":"\/api\/seasons\/5\/messages","status":500,"requestId":"req-1"/,
    );
  });

  it("records status 0 when no response arrived and keeps the last ten", () => {
    for (let i = 0; i < 12; i++)
      recordFailedRequest({ config: { method: "get", url: `/api/${i}` } });
    const failed = collectDiagnostics(context).failedRequests;
    expect(failed).toHaveLength(10);
    expect(failed[0]?.path).toBe("/api/2");
    expect(failed[0]?.status).toBe(0);
  });

  it("ignores errors that are not request failures", () => {
    recordFailedRequest(new Error("boom"));
    expect(collectDiagnostics(context).failedRequests).toEqual([]);
  });
});

describe("collectDiagnostics", () => {
  it("never contains a token, request contents, chat text or invite code", () => {
    createLogger("Auth").error(`failed with Bearer ${TOKEN}`, new Error(`inner ${TOKEN}`));
    recordFailedRequest({
      config: { method: "get", url: "/api/leagues/3?access_token=abc", data: "private chat text" },
      response: { status: 401, headers: { authorization: `Bearer ${TOKEN}` } },
    });
    const text = JSON.stringify(collectDiagnostics(context));
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("private chat text");
    expect(text).not.toContain("SECRETCODE");
    expect(text).not.toContain("access_token");
  });

  it("carries the ids, route, versions, device and the latest Sentry event", () => {
    const diagnostics = collectDiagnostics({ ...context, pathname: "/leagues/3/feed" });
    expect(diagnostics.route).toBe("/leagues/3/feed");
    expect(diagnostics.ids).toEqual({ leagueId: 3, seasonId: 5, teamId: 7 });
    expect(diagnostics.appVersion.api).toBe("abcdef1234");
    expect(diagnostics.sentryEventId).toBe("evt-123");
    expect(diagnostics.device.viewport).toMatch(/^\d+x\d+$/);
    expect(diagnostics.time.timezone).toBeTruthy();
    expect(describeDiagnostics(diagnostics)).toHaveLength(7);
  });
});
