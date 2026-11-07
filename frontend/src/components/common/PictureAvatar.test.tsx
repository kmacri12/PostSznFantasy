import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PictureAvatar from "./PictureAvatar";

describe("PictureAvatar", () => {
  it("shows the initials until a picture is set", () => {
    render(<PictureAvatar name="Kyle Macri" />);
    expect(screen.getByText("KM")).toBeInTheDocument();
  });

  it("shows the bracket tile for a league without a picture", () => {
    const { container } = render(<PictureAvatar name="Sunday Crew" fallback="tile" />);
    expect(screen.queryByText("SC")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeNull();
  });
});
