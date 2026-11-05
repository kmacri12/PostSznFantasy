import type { Breadcrumb, BreadcrumbHint, ErrorEvent } from "@sentry/react";

type SentrySdk = typeof import("@sentry/react");

// Loaded on demand so the SDK stays out of the main bundle and, without a DSN, is never fetched.
let sdk: Promise<SentrySdk> | null = null;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const JWT = /eyJ[\w-]+\.[\w-]+(?:\.[\w-]*)?/g;
const BEARER = /Bearer\s+[\w.~+/=-]+/gi;
const INVITE_CODE = /\/(join|invites)\/[^/?#]+/g;
const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "set-cookie"]);

export const scrubText = (text: string): string =>
  text.replace(JWT, "[token]").replace(BEARER, "Bearer [token]").replace(EMAIL, "[email]");

/** Invite codes grant league access, and query/hash can carry auth redirect tokens. */
export const scrubUrl = (url: string): string =>
  url.replace(/[?#].*$/, "").replace(INVITE_CODE, "/$1/[code]");

const scrubBreadcrumb = (crumb: Breadcrumb): Breadcrumb => {
  if (crumb.message) crumb.message = scrubText(crumb.message);
  const data = crumb.data;
  if (data) {
    for (const key of ["url", "from", "to"]) {
      if (typeof data[key] === "string") data[key] = scrubUrl(data[key]);
    }
  }
  return crumb;
};

export const scrubEvent = (event: ErrorEvent): ErrorEvent => {
  delete event.user;
  if (event.message) event.message = scrubText(event.message);
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = scrubText(value.value);
  }
  const request = event.request;
  if (request) {
    delete request.cookies;
    delete request.query_string;
    if (request.url) request.url = scrubUrl(request.url);
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(
          ([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase()),
        ),
      );
    }
  }
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);
  return event;
};

// Console breadcrumbs duplicate our logger output and may carry free-form user data.
const keepBreadcrumb = (crumb: Breadcrumb, _hint?: BreadcrumbHint): Breadcrumb | null =>
  crumb.category === "console" ? null : scrubBreadcrumb(crumb);

let latestEventId: string | null = null;

/** The id of the last error Sentry was sent, which support can look up. */
export const latestSentryEventId = (): string | null => latestEventId;

const scrubAndRemember = (event: ErrorEvent): ErrorEvent => {
  const scrubbed = scrubEvent(event);
  latestEventId = scrubbed.event_id ?? null;
  return scrubbed;
};

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || sdk) return;
  sdk = import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      // v11 replaced sendDefaultPii with per-category collection; scrubEvent is the backstop.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      beforeSend: scrubAndRemember,
      beforeBreadcrumb: keepBreadcrumb,
    });
    return Sentry;
  });
  // A blocked or failed SDK download must never break the app.
  sdk.catch(() => undefined);
};

const withSdk = (use: (Sentry: SentrySdk) => void): void => {
  sdk?.then(use).catch(() => undefined);
};

export const captureError = (error: unknown, extra?: Record<string, unknown>): void =>
  withSdk((Sentry) => Sentry.captureException(error, extra ? { extra } : undefined));

export const addBreadcrumb = (
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void =>
  withSdk((Sentry) =>
    Sentry.addBreadcrumb({ category, message, level: "info", ...(data ? { data } : {}) }),
  );
