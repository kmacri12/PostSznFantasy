import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "./SignInPage";

const mocks = vi.hoisted(() => ({
  user: null as unknown,
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  callbackError: null as unknown,
}));

vi.mock("../contexts/UserContext", () => ({
  useUser: () => ({
    user: mocks.user,
    loading: false,
    signInWithEmail: mocks.signInWithEmail,
    signInWithGoogle: mocks.signInWithGoogle,
  }),
}));
vi.mock("../components/auth/PostSignInRedirect", () => ({
  default: ({ next }: { next: string }) => <div>redirecting to {next}</div>,
}));
vi.mock("../utils/supabase", () => ({
  get initialCallbackError() {
    return mocks.callbackError;
  },
}));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/join/:code" element={<div>join page</div>} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.user = null;
  mocks.callbackError = null;
  mocks.signInWithEmail.mockReset().mockResolvedValue(null);
  mocks.signInWithGoogle.mockReset().mockResolvedValue(null);
});

describe("SignInPage", () => {
  it("offers magic link and Google", () => {
    renderAt("/sign-in");
    expect(screen.getByRole("button", { name: /email me a sign-in link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("passes the requested destination to both providers", async () => {
    renderAt("/sign-in?next=%2Fjoin%2FABC");
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith("/join/ABC");

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.co" } });
    fireEvent.click(screen.getByRole("button", { name: /email me/i }));
    await screen.findByText(/check your email/i);
    expect(mocks.signInWithEmail).toHaveBeenCalledWith("a@b.co", "/join/ABC");
  });

  it("ignores an off-site next target", () => {
    renderAt("/sign-in?next=%2F%2Fevil.com");
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith("/");
  });

  it("explains an expired link", () => {
    mocks.callbackError = { code: "otp_expired", message: "expired" };
    renderAt("/sign-in");
    expect(screen.getByText(/expired or was already used/i)).toBeInTheDocument();
  });

  it("hands a signed-in visitor to the post-sign-in redirect", () => {
    mocks.user = { id: "u1" };
    renderAt("/sign-in?next=%2Fjoin%2FABC");
    expect(screen.getByText("redirecting to /join/ABC")).toBeInTheDocument();
  });
});

describe("SignInPage legal links", () => {
  it("links to the terms and privacy pages", () => {
    renderAt("/sign-in");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
