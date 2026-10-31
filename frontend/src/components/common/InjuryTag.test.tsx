import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InjuryTag from "./InjuryTag";

describe("InjuryTag", () => {
  it.each(["Out", "Doubtful", "Questionable", "Injured Reserve"])("shows %s in words", (status) => {
    render(<InjuryTag status={status} />);
    expect(screen.getByText(status)).toBeTruthy();
    expect(screen.getByLabelText(`Injury status: ${status}`)).toBeTruthy();
  });

  it("renders nothing without a status", () => {
    const { container } = render(<InjuryTag status={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
