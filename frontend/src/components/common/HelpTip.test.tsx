import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HELP_TIPS, HOW_TO_PLAY_GROUPS } from "../../content/rules";
import HelpTip from "./HelpTip";

const renderTip = () =>
  render(
    <MemoryRouter>
      <HelpTip {...HELP_TIPS.lineupLocks} />
      <button type="button">elsewhere</button>
    </MemoryRouter>,
  );

describe("HelpTip", () => {
  it("is a named button that opens its text on a tap and toggles closed", () => {
    renderTip();
    const button = screen.getByRole("button", { name: "About lineup locks" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(screen.getByRole("note").textContent).toContain(HELP_TIPS.lineupLocks.text);
    expect(button.getAttribute("aria-describedby")).toBe(screen.getByRole("note").id);
    fireEvent.click(button);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("closes on Escape and on a tap outside", async () => {
    renderTip();
    const button = screen.getByRole("button", { name: "About lineup locks" });
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Escape" });
    expect(screen.queryByRole("note")).toBeNull();
    fireEvent.click(button);
    // The click-away listener arms itself on the next tick, after the opening tap.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByRole("button", { name: "elsewhere" }));
    await waitFor(() => expect(screen.queryByRole("note")).toBeNull());
  });

  it("opens on a mouse hover but not on a touch pointer", () => {
    renderTip();
    const button = screen.getByRole("button", { name: "About lineup locks" });
    fireEvent.pointerEnter(button, { pointerType: "touch" });
    expect(screen.queryByRole("note")).toBeNull();
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(screen.getByRole("note")).toBeTruthy();
  });

  it("links Read more to the matching How to play section", () => {
    renderTip();
    fireEvent.click(screen.getByRole("button", { name: "About lineup locks" }));
    expect(screen.getByRole("link", { name: "Read more" }).getAttribute("href")).toBe(
      "/how-to-play#rule-locks",
    );
  });
});

describe("HELP_TIPS", () => {
  it("point at real How to play rules", () => {
    const ids = new Set(HOW_TO_PLAY_GROUPS.flatMap((g) => g.rules.map((r) => r.id)));
    for (const tip of Object.values(HELP_TIPS)) expect(ids.has(tip.ruleId)).toBe(true);
  });
});
