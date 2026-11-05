import { expect, test } from "@playwright/test";
import { Api, unique } from "../support/api";

test.describe("membership in the league feed", () => {
  test("creation, joins and a promotion reach the season feed, and a new member has unread activity", async ({
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Feed League"), { numberTeams: 6 });
    const code = await host.invite(league);
    const guests = [unique("g1"), unique("g2"), unique("g3")].map((uid) => new Api(request, uid));
    for (const [index, guest] of guests.entries()) {
      await guest.signUp(`guest${index + 1}`);
      await guest.joinWith(code);
    }
    const { members } = await host.get<{ members: { userId: number; username: string }[] }>(
      `/api/leagues/${league.leagueId}`,
    );
    const guestTwo = members.find((m) => m.username === "guest2");
    await host.patch(`/api/leagues/${league.leagueId}/members/${guestTwo?.userId}`, {
      role: "commissioner",
    });

    const seasonFeed = (api: Api) =>
      api.get<{ events: { kind: string; isNew: boolean }[]; hasNew: boolean }>(
        `/api/seasons/${league.seasonId}/activity`,
      );
    const feed = await seasonFeed(guests[0]);
    const kinds = feed.events.map((event) => event.kind);
    expect(kinds.filter((kind) => kind === "league_created")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "role_changed")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "membership_joined").length).toBeGreaterThanOrEqual(3);
    expect(feed.hasNew).toBe(true);

    await guests[0].post(`/api/seasons/${league.seasonId}/activity/viewed`, {});
    expect((await seasonFeed(guests[0])).hasNew).toBe(false);
  });
});
