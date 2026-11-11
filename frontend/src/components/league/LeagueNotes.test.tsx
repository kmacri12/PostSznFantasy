import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LeagueInfo } from "../../api/types";
import LeagueNotes from "./LeagueNotes";

vi.mock("../../api/queries", () => ({
  useUpdateLeague: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const league = (extra: Partial<LeagueInfo> = {}): LeagueInfo => ({
  id: 1,
  name: "L",
  notes: "House rules: no trading",
  announcement: null,
  myRole: "member",
  currentSeasonId: 1,
  canStartSeason: false,
  nextYear: 2026,
  seasons: [],
  members: [],
  ...extra,
});

describe("LeagueNotes", () => {
  it("starts collapsed and shows the notes on Show", () => {
    render(<LeagueNotes league={league()} />);
    expect(screen.getByRole("button", { name: /Commissioner notes/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("House rules: no trading")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Commissioner notes/ }));
    expect(screen.getByText("House rules: no trading")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit notes" })).toBeNull();
  });

  it("lets a commissioner edit", () => {
    render(<LeagueNotes league={league({ myRole: "commissioner" })} />);
    fireEvent.click(screen.getByRole("button", { name: /Commissioner notes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit notes" }));
    expect(screen.getByRole("textbox")).toHaveValue("House rules: no trading");
  });
});
