import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./PrivacyPage";
import TermsPage from "./TermsPage";

describe("legal pages", () => {
  it("privacy says what is stored and that nothing is sold", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/email address and, if google provides it, your name/i)).toBeVisible();
    expect(screen.getByText(/sentry/i)).toBeVisible();
    expect(screen.getByText(/do not sell your data/i)).toBeVisible();
  });

  it("terms say it is a free game with no money handled, as is", () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /terms of service/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/free fantasy football game/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: /free game, no money/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: /provided as is/i })).toBeVisible();
  });
});
