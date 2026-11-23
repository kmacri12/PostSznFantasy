import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PICTURE_COLORS, PICTURE_ICONS, pictureColor } from "./generatedPicture";
import PictureAvatar from "./PictureAvatar";

describe("generated team picture", () => {
  it("has the palette sizes the API assigns from", () => {
    expect(PICTURE_COLORS).toHaveLength(12);
    expect(PICTURE_ICONS).toHaveLength(12);
    expect(new Set(PICTURE_COLORS).size).toBe(12);
  });

  it("wraps an index that is out of range", () => {
    expect(pictureColor(12)).toBe(pictureColor(0));
    expect(pictureColor(-1)).toBe(pictureColor(11));
  });

  it("draws the colour and icon when the team has no upload, and the upload when it has", () => {
    const { container, rerender } = render(
      <PictureAvatar url={null} name="Team 1" generated={{ color: 3, icon: 0 }} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).not.toContain("T1");
    rerender(
      <PictureAvatar url="/api/avatars/abc" name="Team 1" generated={{ color: 3, icon: 0 }} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("falls back to initials without a generated picture", () => {
    const { container } = render(<PictureAvatar url={null} name="Team 1" />);
    expect(container.textContent).toBe("T1");
  });
});
