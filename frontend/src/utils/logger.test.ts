import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";
import { captureError } from "./sentry";

vi.mock("./sentry", () => ({ captureError: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("createLogger", () => {
  it("forwards the Error and string context of error() to Sentry", () => {
    const error = new Error("boom");
    createLogger("Scope").error("Uncaught render error", error, "at App", { user: "x" });

    expect(captureError).toHaveBeenCalledWith(error, { scope: "Scope", notes: ["at App"] });
  });

  it("wraps the message in an Error when none was passed", () => {
    createLogger("Scope").error("Socket error", new Event("error"));

    const error = vi.mocked(captureError).mock.calls[0]?.[0];
    expect((error as Error).message).toBe("[Scope] Socket error");
  });

  it("does not forward warnings", () => {
    createLogger("Scope").warn("careful");

    expect(captureError).not.toHaveBeenCalled();
  });
});
