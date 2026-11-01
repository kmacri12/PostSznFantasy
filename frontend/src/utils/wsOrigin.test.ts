import { describe, expect, it } from "vitest";
import { resolveWsOrigin } from "./wsOrigin";

const page = { protocol: "https:", host: "postsznfantasy.com" };

describe("resolveWsOrigin", () => {
  it("prefers the explicit WebSocket URL", () => {
    expect(resolveWsOrigin("wss://ws.example.com", "https://api.example.com", page)).toBe(
      "wss://ws.example.com",
    );
  });

  it("derives wss from an https API origin and ws from http", () => {
    expect(resolveWsOrigin("", "https://api.example.com", page)).toBe("wss://api.example.com");
    expect(resolveWsOrigin(undefined, "http://localhost:8000", page)).toBe("ws://localhost:8000");
  });

  it("falls back to the page origin", () => {
    expect(resolveWsOrigin(undefined, undefined, page)).toBe("wss://postsznfantasy.com");
    expect(resolveWsOrigin(undefined, "", { protocol: "http:", host: "localhost:5173" })).toBe(
      "ws://localhost:5173",
    );
  });
});
