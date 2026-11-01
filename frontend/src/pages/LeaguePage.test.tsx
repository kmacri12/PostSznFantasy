import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { testSeason } from "../test/season";
import { SeasonNotices } from "./LeaguePage";

const notices = (overrides: Parameters<typeof testSeason>[0]) =>
  render(<SeasonNotices season={testSeason(overrides).season} />);

describe("SeasonNotices", () => {
  it("explains a member's missing team in an open season", () => {
    notices({ myTeamId: null });
    expect(screen.getByText(/don't have a team in the 2025 season yet/)).toBeInTheDocument();
  });

  it("says a finished season gave the member no team", () => {
    notices({ myTeamId: null, finished: true, canEdit: false });
    expect(screen.getByText("You didn't have a team in the 2025 season.")).toBeInTheDocument();
  });

  it("says nobody is credited for teams left without an owner", () => {
    notices({ finished: true, canEdit: false, openSpots: 1 });
    expect(screen.getByText(/no one is credited for it/)).toBeInTheDocument();
  });

  it("stays quiet for a former member and a full open season", () => {
    const { container } = notices({ myTeamId: null, isFormerMember: true });
    expect(container).toBeEmptyDOMElement();
  });
});
