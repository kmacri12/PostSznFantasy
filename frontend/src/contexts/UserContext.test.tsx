import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider, useUser } from "./UserContext";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  post: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../utils/supabase", () => ({
  auth: {
    getSession: mocks.getSession,
    onAuthStateChange: mocks.onAuthStateChange,
    signOut: mocks.signOut,
  },
}));
vi.mock("../api/client", () => ({ api: { post: mocks.post } }));

const sessionFor = (id: string, token: string) => ({
  access_token: token,
  user: { id, email: `${id}@x.co`, user_metadata: { full_name: "Pat Player" } },
});

const SignInTrigger = () => {
  const { signIn } = useUser();
  const location = useLocation();
  return (
    <button type="button" onClick={signIn}>
      go {location.pathname}
      {location.search}
    </button>
  );
};

const Probe = () => {
  const { userId, loading, syncError, sessionExpired, signOutUser } = useUser();
  return (
    <div>
      <span data-testid="expired">{sessionExpired ? "expired" : "no"}</span>
      <button type="button" onClick={signOutUser}>
        out
      </button>
      <span data-testid="state">{loading ? "loading" : "ready"}</span>
      <span data-testid="user">{userId ?? "none"}</span>
      <span data-testid="error">{syncError ?? ""}</span>
    </div>
  );
};

let queryClient: QueryClient;
let emitAuthChange: (session: unknown) => void;

beforeEach(() => {
  queryClient = new QueryClient();
  mocks.signOut.mockReset().mockImplementation(async () => emitAuthChange(null));
  mocks.post.mockReset().mockResolvedValue({ data: { userId: 42 } });
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: sessionFor("u1", "t1") } });
  mocks.onAuthStateChange.mockReset().mockImplementation((callback) => {
    emitAuthChange = (session) => callback("TOKEN_REFRESHED", session);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});

const renderProbe = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserProvider>
          <Probe />
        </UserProvider>
      </MemoryRouter>
    </QueryClientProvider>,
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
      expect(screen.getByTestId("error").textContent).toMatch(/couldn.t reach the server/i),
    );
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("flags an unexpected sign-out as an expired session", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("42"));

    act(() => emitAuthChange(null));
    await waitFor(() => expect(screen.getByTestId("expired").textContent).toBe("expired"));
  });

  it("does not call a deliberate sign-out an expired session, and drops cached data", async () => {
    queryClient.setQueryData(["leagues"], [{ id: 1 }]);
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("42"));

    fireEvent.click(screen.getByText("out"));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("none"));

    expect(screen.getByTestId("expired").textContent).toBe("no");
    expect(queryClient.getQueryData(["leagues"])).toBeUndefined();
  });

  it("clears the expired flag once the user signs back in", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("42"));
    act(() => emitAuthChange(null));
    await waitFor(() => expect(screen.getByTestId("expired").textContent).toBe("expired"));

    act(() => emitAuthChange(sessionFor("u1", "t9")));
    await waitFor(() => expect(screen.getByTestId("expired").textContent).toBe("no"));
  });

  it("sends signIn() to the sign-in page remembering the invite link it came from", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/join/ABC123"]}>
          <UserProvider>
            <SignInTrigger />
          </UserProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByText(/go \/join\/ABC123/));
    expect(await screen.findByText("go /sign-in?next=%2Fjoin%2FABC123")).toBeInTheDocument();
  });
});
