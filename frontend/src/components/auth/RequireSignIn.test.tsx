import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequireSignIn from "./RequireSignIn";

const mocks = vi.hoisted(() => ({
  user: { user: null as object | null, loading: false },
}));

vi.mock("../../contexts/UserContext", () => ({ useUser: () => mocks.user }));

const SignInProbe = () => {
  const { pathname, search } = useLocation();
  return <div>{`sign-in at ${pathname}${search}`}</div>;
};

const renderGuard = () =>
  render(
    <MemoryRouter initialEntries={["/create-league"]}>
      <Routes>
        <Route
          path="/create-league"
          element={
            <RequireSignIn>
              <div>wizard</div>
            </RequireSignIn>
          }
        />
        <Route path="/sign-in" element={<SignInProbe />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.user = { user: null, loading: false };
});

describe("RequireSignIn", () => {
  it("sends a signed-out visitor to sign-in, returning to the page afterwards", () => {
    renderGuard();
    expect(screen.getByText("sign-in at /sign-in?next=%2Fcreate-league")).toBeInTheDocument();
    expect(screen.queryByText("wizard")).not.toBeInTheDocument();
  });

  it("shows nothing of the page while the session is still resolving", () => {
    mocks.user = { user: null, loading: true };
    renderGuard();
    expect(screen.queryByText("wizard")).not.toBeInTheDocument();
    expect(screen.queryByText(/sign-in at/)).not.toBeInTheDocument();
  });

  it("renders the page for a signed-in user", () => {
    mocks.user = { user: {}, loading: false };
    renderGuard();
    expect(screen.getByText("wizard")).toBeInTheDocument();
  });
});
