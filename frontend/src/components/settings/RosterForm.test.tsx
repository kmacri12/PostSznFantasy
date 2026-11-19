import { fireEvent, render, screen } from "@testing-library/react";
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
            "Starters:\n1 QB\n2 RB\n2 WR\n1 TE\n1 FLEX (WR/RB/TE)\n1 K\n1 DEF\n8 bench",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Roster size: 17")).toBeInTheDocument();
  });
});

describe("RosterForm position limits of 99", () => {
  const open = { ...values, roster_max_rb: 99, roster_max_wr: 99 };

  it("says No limit in the locked summary and never 99", () => {
    const { container } = render(<RosterForm values={open} onChange={() => {}} disabled />);
    expect(container.textContent).toContain("RB: No limit");
    expect(container.textContent).not.toContain("99");
  });

  it("shows an empty field with a No limit placeholder and saves a cleared field as 99", () => {
    const changes: Record<string, number | string>[] = [];
    const { container } = render(<RosterForm values={open} onChange={(v) => changes.push(v)} />);
    expect(container.textContent).not.toContain("99");
    fireEvent.click(screen.getByRole("button", { name: /Position limits/ }));
    const field = screen.getByLabelText("Max RB");
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("placeholder", "No limit");
    fireEvent.change(screen.getByLabelText("Max QB"), { target: { value: "" } });
    expect(changes.at(-1)?.roster_max_qb).toBe("99");
  });
});
