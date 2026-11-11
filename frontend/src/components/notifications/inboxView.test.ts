import { describe, expect, it } from "vitest";
import type { InboxItem } from "../../api/types";
import { describeNotification } from "./inboxView";

const item = (kind: string, payload: InboxItem["payload"] = { seasonId: 9 }): InboxItem => ({
  id: 1,
  kind,
  leagueId: 3,
  leagueName: "Family League",
  payload,
  createdAt: "2027-01-09T12:00:00Z",
  read: false,
});

describe("describeNotification", () => {
  it("links draft notifications to the draft room, as their pushes do", () => {
    for (const kind of [
      "draft_turn",
      "draft_lobby",
      "draft_started",
      "draft_soon",
      "draft_scheduled",
    ]) {
      expect(describeNotification(item(kind)).path).toBe("/leagues/3/draft");
    }
    expect(describeNotification(item("draft_turn"))).toMatchObject({
      title: "You're on the clock",
      body: "Your pick is up in Family League.",
    });
  });

  it("links lineup notifications to the team and names the round", () => {
    const payload = { seasonId: 9, teamId: 12, round: 2 };
    expect(describeNotification(item("lineup_lock", payload))).toEqual({
      title: "Lineup locks in about an hour",
      body: "You have an empty Divisional starter slot in Family League.",
      path: "/leagues/3/teams/12",
    });
    expect(describeNotification(item("lineup_changed", payload))).toEqual({
      title: "A commissioner changed your lineup",
      body: "Your Divisional lineup in Family League.",
      path: "/leagues/3/teams/12",
    });
  });

  it("words the player alerts and links them to the team or the standings", () => {
    const payload = { seasonId: 9, teamId: 12, round: 1 };
    expect(describeNotification(item("starter_out", payload))).toEqual({
      title: "A starter is hurt",
      body: "Check your Wild Card lineup in Family League.",
      path: "/leagues/3/teams/12",
    });
    expect(describeNotification(item("player_scored", payload)).path).toBe("/leagues/3/teams/12");
    expect(describeNotification(item("round_result", payload))).toEqual({
      title: "Wild Card is final",
      body: "See how you moved in Family League.",
      path: "/leagues/3",
    });
    expect(describeNotification(item("team_eliminated", { seasonId: 9, teamId: 12 }))).toEqual({
      title: "Your last player's team lost",
      body: "You're out of players in Family League.",
      path: "/leagues/3",
    });
  });

  it("still links a kind this build does not know to its league", () => {
    expect(describeNotification(item("player_eliminated"))).toEqual({
      title: "Family League",
      body: "Something new in your league.",
      path: "/leagues/3",
    });
  });
});
