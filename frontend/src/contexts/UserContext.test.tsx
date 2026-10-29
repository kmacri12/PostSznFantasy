import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider, useUser } from "./UserContext";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../utils/supabase", () => ({
  supabase: {
    auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange },
  },
}));
vi.mock("../api/client", () => ({ api: { post: mocks.post } }));

const sessionFor = (id: string, token: string) => ({
  access_token: token,
  user: { id, email: `${id}@x.co`, user_metadata: { full_name: "Pat Player" } },
});

const Probe = () => {
  const { userId, loading, syncError } = useUser();
  return (
    <div>
      <span data-testid="state">{loading ? "loading" : "ready"}</span>
      <span data-testid="user">{userId ?? "none"}</span>
      <span data-testid="error">{syncError ?? ""}</span>
    </div>
  );
};

let emitAuthChange: (session: unknown) => void;

beforeEach(() => {
  mocks.post.mockReset().mockResolvedValue({ data: { userId: 42 } });
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: sessionFor("u1", "t1") } });
  mocks.onAuthStateChange.mockReset().mockImplementation((callback) => {
    emitAuthChange = (session) => callback("TOKEN_REFRESHED", session);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});

const renderProbe = () =>
  render(
    <UserProvider>
      <Probe />
    </UserProvider>,
  );

describe("UserProvider auth flow", () => {
  it("signs the user in with the backend user id", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("42"));
    expect(mocks.post).toHaveBeenCalledWith("/api/auth/login", {
      email: "u1@x.co",
      username: "Pat Player",
    });
  });

  it("does not re-post /auth/login when only the token refreshes", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("42"));

    act(() => emitAuthChange(sessionFor("u1", "t2")));
    act(() => emitAuthChange(sessionFor("u1", "t3")));

    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("clears the backend user on sign-out", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("42"));

    act(() => emitAuthChange(null));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("none"));
  });

  it("surfaces a login sync failure instead of only logging it", async () => {
    mocks.post.mockRejectedValue(new Error("down"));
    renderProbe();
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toMatch(/could not reach/i),
    );
    expect(screen.getByTestId("user").textContent).toBe("none");
  });
});
