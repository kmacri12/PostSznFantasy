// Cloudflare Pages Function for /join/:code. Link-preview crawlers do not run the SPA, so they
// get index.html with this invite's league name and open spots in the head; everyone else gets
// the SPA untouched. Only what the public invite preview already shows: no member names or emails.

interface Env {
  ASSETS: { fetch: (request: Request | string | URL) => Promise<Response> };
  /** Where the public invite preview lives; the production API unless overridden. */
  API_ORIGIN?: string;
}

interface Context {
  request: Request;
  env: Env;
  params: { code?: string | string[] };
  next: () => Promise<Response>;
}

interface InvitePreview {
  leagueName: string;
  season: number;
  openSpots: number;
  full: boolean;
  joinable: boolean;
}

const DEFAULT_API_ORIGIN = "https://api.postsznfantasy.com";
const CRAWLERS =
  /facebookexternalhit|facebot|whatsapp|twitterbot|slackbot|slack-imgproxy|linkedinbot|telegrambot|discordbot|applebot|linkpresentation|skypeuripreview|pinterest|redditbot|googlebot|bingbot|mastodon|signal/i;
const INVITE_CODE = /^[A-Za-z0-9_-]{4,64}$/;
const PREVIEW_TIMEOUT_MS = 2500;
const SITE_NAME = "PostSzn Fantasy";

export const isCrawler = (userAgent: string | null): boolean =>
  userAgent !== null && CRAWLERS.test(userAgent);

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export interface PreviewText {
  title: string;
  description: string;
}

export const previewText = (invite: InvitePreview | null): PreviewText => {
  if (!invite || (!invite.joinable && !invite.full)) {
    return {
      title: `Join a league on ${SITE_NAME}`,
      description:
        "Fantasy football for the NFL postseason: draft a team, then watch players drop out as their real teams lose.",
    };
  }
  const title = `Join ${invite.leagueName} on PostSzn`;
  if (invite.full) {
    return {
      title,
      description: `${invite.leagueName} is full for the ${invite.season} playoffs.`,
    };
  }
  const spots = `${invite.openSpots} open ${invite.openSpots === 1 ? "spot" : "spots"}`;
  return {
    title,
    description: `${spots} in this ${invite.season} playoff fantasy football league. Tap to join.`,
  };
};

const META_TO_REPLACE = /<meta[^>]*(?:property="og:|name="twitter:|name="description")[^>]*>\s*/g;

/** index.html with the page title, description and Open Graph / Twitter tags for this invite. */
export const withPreview = (
  html: string,
  text: PreviewText,
  url: string,
  image: string,
): string => {
  const title = escapeHtml(text.title);
  const description = escapeHtml(text.description);
  const tags = [
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ].join("\n    ");
  return html
    .replace(META_TO_REPLACE, "")
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace("</head>", `    ${tags}\n  </head>`);
};

const fetchInvite = async (origin: string, code: string): Promise<InvitePreview | null> => {
  try {
    const response = await fetch(`${origin}/api/invites/${encodeURIComponent(code)}`, {
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });
    return response.ok ? ((await response.json()) as InvitePreview) : null;
  } catch {
    return null;
  }
};

export const onRequest = async ({ request, env, params, next }: Context): Promise<Response> => {
  if (request.method !== "GET" || !isCrawler(request.headers.get("user-agent"))) return next();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const url = new URL(request.url);
  const invite =
    code && INVITE_CODE.test(code)
      ? await fetchInvite(env.API_ORIGIN ?? DEFAULT_API_ORIGIN, code)
      : null;
  const page = await env.ASSETS.fetch(new URL("/", url));
  const html = withPreview(
    await page.text(),
    previewText(invite),
    url.toString(),
    new URL("/og-image.png", url).toString(),
  );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // A few minutes: spots fill up, but crawlers should not hammer the API.
      "cache-control": "public, max-age=300",
    },
  });
};
