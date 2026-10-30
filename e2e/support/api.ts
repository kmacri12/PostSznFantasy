import { type APIRequestContext, expect } from "@playwright/test";
import { authHeaders } from "./auth";
import { API_URL } from "./env";

export interface RosterShape {
  numberTeams?: number;
  rosterTotal?: number;
  rosterNumQb?: number;
  rosterNumRb?: number;
  rosterNumWr?: number;
  rosterNumTe?: number;
  rosterNumFlexWrRbTe?: number;
  rosterNumK?: number;
  rosterNumDst?: number;
  rosterNumBench?: number;
}

/** A small roster (QB, RB, WR, bench) so a full draft is only a handful of picks. */
export const TINY_ROSTER: Required<RosterShape> = {
  numberTeams: 2,
  rosterTotal: 4,
  rosterNumQb: 1,
  rosterNumRb: 1,
  rosterNumWr: 1,
  rosterNumTe: 0,
  rosterNumFlexWrRbTe: 0,
  rosterNumK: 0,
  rosterNumDst: 0,
  rosterNumBench: 1,
};

const COMMIT_LAG_404 = /User not found|Invite not found/;

/** Thin JSON client for arranging state quickly; flows under test still go through the UI. */
export class Api {
  constructor(
    private readonly request: APIRequestContext,
    readonly uid: string,
  ) {}

  private async send<T>(method: string, path: string, data?: unknown): Promise<T> {
    // The request transaction commits just after the response is sent, so the next
    // request can briefly miss the row (seen as 404 "User not found" after login and
    // 404 "Invite not found" after creating an invite). Retried here so the harness is
    // steady; it is recorded as an app finding (#123).
    for (let attempt = 0; ; attempt++) {
      const response = await this.request.fetch(`${API_URL}${path}`, {
        method,
        headers: authHeaders(this.uid),
        data,
      });
      const body = await response.text();
      if (response.status() === 404 && COMMIT_LAG_404.test(body) && attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      expect(response.ok(), `${method} ${path} -> ${response.status()} ${body}`).toBe(true);
      return (body ? JSON.parse(body) : undefined) as T;
    }
  }

  get = <T>(path: string) => this.send<T>("GET", path);
  post = <T>(path: string, data?: unknown) => this.send<T>("POST", path, data);
  put = <T>(path: string, data?: unknown) => this.send<T>("PUT", path, data);
  patch = <T>(path: string, data?: unknown) => this.send<T>("PATCH", path, data);

  async signUp(username = this.uid): Promise<number> {
    const { userId } = await this.post<{ userId: number }>("/api/auth/login", {
      email: `${this.uid}@e2e.test`,
      username: username.slice(0, 20),
    });
    return userId;
  }

  async createLeague(name: string, roster: RosterShape = TINY_ROSTER): Promise<number> {
    const { leagueId } = await this.post<{ leagueId: number }>("/api/leagues/create-league", {
      leagueName: name,
      rosterSettings: { ...TINY_ROSTER, ...roster },
    });
    return leagueId;
  }

  /** Creates an invite and returns its code. */
  async invite(leagueId: number): Promise<string> {
    const { code } = await this.post<{ code: string }>(`/api/leagues/${leagueId}/invite`, {});
    return code;
  }

  joinWith = (code: string) => this.post(`/api/invites/${code}/join`);
}

let counter = 0;
const runId = Date.now().toString(36);
/** Unique per test run so specs never collide on users or league names. */
export const unique = (prefix: string): string => `${prefix}-${runId}-${++counter}`;
