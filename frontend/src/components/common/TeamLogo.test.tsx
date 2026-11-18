import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTeamLogosForTests } from "../../api/teamLogos";
import TeamLogo from "./TeamLogo";

const get = vi.fn();
vi.mock("../../api/client", () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

const URL = "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/buf.png";

describe("TeamLogo", () => {
  beforeEach(() => {
    resetTeamLogosForTests();
    get.mockReset();
  });

  it("shows a fixed-size lazy logo for a team that has one", async () => {
    get.mockResolvedValue({ data: { BUF: URL } });
    const { container } = render(<TeamLogo abbreviation="BUF" size={20} />);
    await act(async () => {});
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", URL);
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", "20");
  });

  it("renders nothing for a team without a logo, and drops a logo that fails to load", async () => {
    get.mockResolvedValue({ data: { BUF: URL } });
    const { container } = render(
      <>
        <TeamLogo abbreviation="LAR" />
        <TeamLogo abbreviation="BUF" />
      </>,
    );
    await act(async () => {});
    expect(container.querySelectorAll("img")).toHaveLength(1);
    fireEvent.error(container.querySelector("img") as Element);
    expect(container.querySelector("img")).toBeNull();
  });
});
