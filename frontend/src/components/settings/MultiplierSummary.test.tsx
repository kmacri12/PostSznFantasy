import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MultiplierSummary from "./MultiplierSummary";

describe("MultiplierSummary", () => {
  it("shows abbreviations over values and names the full rounds for screen readers", () => {
    render(
      <MultiplierSummary
        values={{
          multiplier_wild_card: 1,
          multiplier_divisional: 1,
          multiplier_conference: 2,
          multiplier_super_bowl: 3,
        }}
      />,
    );
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "WCWild Card",
      "DIVDivisional",
      "CONFConference",
      "SBSuper Bowl",
    ]);
    expect(screen.getAllByRole("cell").map((c) => c.textContent)).toEqual(["1x", "1x", "2x", "3x"]);
  });
});
