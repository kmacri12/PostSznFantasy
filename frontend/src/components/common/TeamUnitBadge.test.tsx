import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeamUnitBadge, { teamUnitHint } from "./TeamUnitBadge";

describe("TeamUnitBadge", () => {
  it("says which NFL team's players the slot scores", () => {
    expect(teamUnitHint("QB", "PHI")).toBe("Scores all PHI QBs");
    expect(teamUnitHint("K", "KC")).toBe("Scores all KC Ks");
  });

  it("is named for screen readers and shows its explanation on a tap", async () => {
    render(<TeamUnitBadge position="QB" teamAbv="PHI" />);
    const badge = screen.getByRole("note", { name: "Team QB. Scores all PHI QBs" });
    fireEvent.touchStart(badge);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Scores all PHI QBs");
  });
});
