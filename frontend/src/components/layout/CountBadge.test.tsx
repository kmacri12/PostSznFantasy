import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountBadge } from "./CountBadge";

describe("CountBadge", () => {
  it("shows the number with a spoken label", () => {
    render(<CountBadge count={7} />);
    expect(screen.getByRole("img", { name: "7 new" })).toHaveTextContent("7");
  });

  it("caps large numbers but still says the real count", () => {
    render(<CountBadge count={120} />);
    expect(screen.getByRole("img", { name: "120 new" })).toHaveTextContent("99+");
  });
});
