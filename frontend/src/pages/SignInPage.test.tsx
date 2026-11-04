import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "./SignInPage";

const mocks = vi.hoisted(() => ({
  user: null as unknown,
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  signInWithGoogle: vi.fn(),
  callbackError: null as unknown,
}));

vi.mock("../contexts/UserContext", () => ({
  useUser: () => ({
    user: mocks.user,
    loading: false,
    sendEmailCode: mocks.sendEmailCode,
    verifyEmailCode: mocks.verifyEmailCode,
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
  mocks.sendEmailCode.mockReset().mockResolvedValue(null);
  mocks.verifyEmailCode.mockReset().mockResolvedValue(null);
  mocks.signInWithGoogle.mockReset().mockResolvedValue(null);
});

describe("SignInPage", () => {
  it("offers an emailed code and Google", () => {
    renderAt("/sign-in");
    expect(screen.getByRole("button", { name: /email me a sign-in code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("passes the requested destination to Google", () => {
    renderAt("/sign-in?next=%2Fjoin%2FABC");
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith("/join/ABC");
  });

  it("sends the code request and then verifies the typed code", async () => {
    renderAt("/sign-in");
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.co" } });
    fireEvent.click(screen.getByRole("button", { name: /email me/i }));
    fireEvent.change(await screen.findByLabelText(/sign-in code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.verifyEmailCode).toHaveBeenCalledWith("a@b.co", "123456"));
    expect(mocks.sendEmailCode).toHaveBeenCalledWith("a@b.co");
  });

  it("ignores an off-site next target", () => {
    renderAt("/sign-in?next=%2F%2Fevil.com");
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith("/");
  });

  it("explains a failed Google callback", () => {
    mocks.callbackError = { code: "access_denied", message: "denied" };
    renderAt("/sign-in");
    expect(screen.getByText(/couldn't finish signing you in/i)).toBeInTheDocument();
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
