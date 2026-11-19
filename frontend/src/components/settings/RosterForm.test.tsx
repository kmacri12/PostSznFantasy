import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RosterForm from "./RosterForm";

const values = {
  roster_num_qb: 1,
  roster_num_rb: 2,
  roster_num_wr: 2,
  roster_num_te: 1,
  roster_num_flex_wr_rb_te: 1,
  roster_num_flex_wr_rb: 0,
  roster_num_flex_wr_te: 0,
  roster_num_flex_qb_wr_rb_te: 0,
  roster_num_k: 1,
  roster_num_dst: 1,
  roster_num_bench: 8,
  roster_max_qb: 4,
  roster_max_rb: 8,
  roster_max_wr: 8,
  roster_max_te: 4,
  roster_max_k: 3,
  roster_max_dst: 3,
  roster_total: 17,
};

describe("RosterForm when locked", () => {
  it("is a one-line-per-group summary with no inputs and carries the lock note", () => {
    render(
      <RosterForm
        values={values}
        onChange={() => {}}
        disabled
        lockedNote="Locked since the draft started."
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Locked since the draft started.")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName === "P" &&
          node.textContent ===
            "Starters: 1 QB · 2 RB · 2 WR · 1 TE · 1 FLEX (WR/RB/TE) · 1 K · 1 DEF · 8 bench",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Roster size: 17")).toBeInTheDocument();
  });
});
