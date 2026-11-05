import { fireEvent, render, screen } from "@testing-library/react";

import { afterEach, describe, expect, it } from "vitest";
import { ThemeModeProvider } from "../../contexts/ThemeModeContext";
import { THEME_STORAGE_KEY } from "../../utils/themeMode";
import ThemeModeRow from "./ThemeModeRow";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

const renderRow = () =>
  render(
    <ThemeModeProvider>
      <ThemeModeRow />
    </ThemeModeProvider>,
  );

describe("ThemeModeRow", () => {
  it("starts on Dark and switches to Light at once, remembering the choice", () => {
    renderRow();
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("starts on the saved choice", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    renderRow();
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps one choice on when the selected one is tapped again", () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });
});
