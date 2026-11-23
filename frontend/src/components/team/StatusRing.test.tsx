import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusRing from "./StatusRing";

const ring = (counts: { advanced: number; live: number; toPlay: number; eliminated: number }) =>
  render(
    <StatusRing counts={counts} size={44}>
      <span>pic</span>
    </StatusRing>,
  );

describe("StatusRing", () => {
  it("draws one dot per rostered player around the picture", () => {
    const { container } = ring({ advanced: 3, live: 2, toPlay: 5, eliminated: 1 });
    expect(container.querySelectorAll("circle")).toHaveLength(11);
    expect(screen.getByText("pic")).toBeInTheDocument();
    expect(screen.queryByTestId("out-wash")).toBeNull();
  });

  it("washes the picture red only when every player is eliminated", () => {
    ring({ advanced: 0, live: 0, toPlay: 0, eliminated: 15 });
    expect(screen.getByTestId("out-wash")).toBeInTheDocument();
  });

  it("is just the picture without a roster", () => {
    const { container } = render(
      <StatusRing counts={null} size={44}>
        <span>pic</span>
      </StatusRing>,
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText("pic")).toBeInTheDocument();
  });
});
