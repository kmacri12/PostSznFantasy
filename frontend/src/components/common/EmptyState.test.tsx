import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AppToast from "./AppToast";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("shows a decorative illustration, the text and the one action", () => {
    const { container } = render(
      <EmptyState
        illustration="leagues"
        title="No leagues yet"
        description="Start one."
        action={<button type="button">Create a league</button>}
      />,
    );
    expect(screen.getByText("No leagues yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create a league" })).toBeTruthy();
    const art = container.querySelector("svg[data-illustration='leagues']");
    expect(art?.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws nothing extra without an illustration", () => {
    const { container } = render(<EmptyState title="Nothing" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("AppToast", () => {
  it("renders the message as a status alert when open", () => {
    render(<AppToast open message="Saved" onClose={() => {}} />);
    expect(screen.getByRole("alert").textContent).toContain("Saved");
  });
});
