import { type FailedRequest, recentFailedRequests } from "../api/failedRequests";
import { type LogEntry, recentLogEntries } from "./logger";
import { latestSentryEventId, scrubUrl } from "./sentry";

/** What the member can see and send with a report. Ids only; never names, bodies or tokens. */
export interface Diagnostics {
  appVersion: { web: string | null; api: string | null };
  route: string;
  ids: { leagueId: number | null; seasonId: number | null; teamId: number | null };
  device: {
    userAgent: string;
    platform: string;
    language: string;
    viewport: string;
    pixelRatio: number;
    installedToHomeScreen: boolean;
  };
  time: { iso: string; timezone: string };
  sentryEventId: string | null;
  logs: LogEntry[];
  failedRequests: FailedRequest[];
}

export interface DiagnosticsContext {
  pathname: string;
  apiVersion: string | null;
  leagueId: number | null;
  seasonId: number | null;
  teamId: number | null;
}

const installedToHomeScreen = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  (navigator as { standalone?: boolean }).standalone === true;

export const collectDiagnostics = (context: DiagnosticsContext): Diagnostics => ({
  appVersion: { web: __WEB_VERSION__ || null, api: context.apiVersion || null },
  route: scrubUrl(context.pathname),
  ids: { leagueId: context.leagueId, seasonId: context.seasonId, teamId: context.teamId },
  device: {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pixelRatio: window.devicePixelRatio,
    installedToHomeScreen: installedToHomeScreen(),
  },
  time: {
    iso: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  sentryEventId: latestSentryEventId(),
  logs: recentLogEntries(),
  failedRequests: recentFailedRequests(),
});

/** One line per part, in the words the member sees under "What's included". */
export const describeDiagnostics = (diagnostics: Diagnostics): string[] => [
  `App version (website ${diagnostics.appVersion.web?.slice(0, 7) ?? "unknown"}, server ${
    diagnostics.appVersion.api?.slice(0, 7) ?? "unknown"
  })`,
  `The page you were on and the league, season and team ids (${diagnostics.route})`,
  `Your device, browser and screen size (${diagnostics.device.viewport})`,
  `The time and your time zone (${diagnostics.time.timezone})`,
  `The last ${diagnostics.logs.length} app log lines`,
  `The last ${diagnostics.failedRequests.length} failed requests: method, address, result, no contents`,
  `The id of the latest error report${diagnostics.sentryEventId ? "" : " (none yet)"}`,
];
