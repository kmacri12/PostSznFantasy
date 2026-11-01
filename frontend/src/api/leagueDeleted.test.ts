import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { leagueDeletedInfo, recheckLeagueOnDeleted } from "./leagueDeleted";

const deleted = {
  response: {
    status: 404,
    data: { code: "leagueDeleted", leagueName: "Dynasty Bros", deletedAt: "2026-11-01T12:00:00Z" },
  },
};

describe("leagueDeletedInfo", () => {
  it("reads the league name and date from the 404", () => {
    expect(leagueDeletedInfo(deleted)).toEqual({
      leagueName: "Dynasty Bros",
      deletedAt: "2026-11-01T12:00:00Z",
    });
  });

  it("ignores a plain 404 and other errors", () => {
    expect(leagueDeletedInfo({ response: { status: 404, data: { detail: "x" } } })).toBeNull();
    expect(leagueDeletedInfo(new Error("Network Error"))).toBeNull();
    expect(leagueDeletedInfo(null)).toBeNull();
  });
});

describe("recheckLeagueOnDeleted", () => {
  it("rechecks the league's seasons so the layout shows the deleted page", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    recheckLeagueOnDeleted(client, deleted, ["standings", "9"]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["league-seasons"] });
  });

  it("does nothing for other errors or for the seasons query itself (no refetch loop)", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    recheckLeagueOnDeleted(client, new Error("x"), ["standings", "9"]);
    recheckLeagueOnDeleted(client, deleted, ["league-seasons", "3"]);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
