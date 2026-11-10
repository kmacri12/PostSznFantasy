import { afterEach, describe, expect, it, vi } from "vitest";
import { isCrawler, onRequest, previewText, withPreview } from "../functions/join/[code]";

const html = `<!doctype html><html lang="en"><head>
    <title>PostSzn Fantasy</title>
    <meta
      name="description"
      content="Generic."
    />
    <meta property="og:title" content="PostSzn Fantasy" />
    <meta name="twitter:card" content="summary" />
  </head><body><div id="root"></div></body></html>`;

const invite = {
  leagueName: "Fam <b>League</b>",
  season: 2026,
  openSpots: 3,
  full: false,
  joinable: true,
};

const context = (userAgent: string, apiResponse?: Response) => {
  const next = vi.fn(async () => new Response("spa"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => apiResponse ?? new Response("{}", { status: 404 })),
  );
  return {
    next,
    ctx: {
      request: new Request("https://postsznfantasy.com/join/ABCD2345", {
        headers: { "user-agent": userAgent },
      }),
      env: { ASSETS: { fetch: async () => new Response(html) } },
      params: { code: "ABCD2345" },
      next,
    },
  };
};

afterEach(() => vi.unstubAllGlobals());

describe("isCrawler", () => {
  it("recognizes the chat and social link fetchers", () => {
    expect(isCrawler("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(
      isCrawler("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"),
    ).toBe(true);
    expect(isCrawler("Mozilla/5.0 (iPhone) Safari/604.1 Applebot/0.1")).toBe(true);
  });
  it("leaves browsers alone", () => {
    expect(isCrawler("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1")).toBe(false);
    expect(isCrawler(null)).toBe(false);
  });
});

describe("previewText", () => {
  it("names the league and the open spots", () => {
    expect(previewText(invite)).toEqual({
      title: "Join Fam <b>League</b> on PostSzn",
      description: "3 open spots in this 2026 playoff fantasy football league. Tap to join.",
    });
    expect(previewText({ ...invite, openSpots: 1 }).description).toContain("1 open spot in");
  });
  it("says a full league is full", () => {
    expect(previewText({ ...invite, openSpots: 0, full: true, joinable: false }).description).toBe(
      "Fam <b>League</b> is full for the 2026 playoffs.",
    );
  });
  it("falls back to a generic card for an unknown or unusable invite", () => {
    expect(previewText(null).title).toBe("Join a league on PostSzn Fantasy");
    expect(previewText({ ...invite, joinable: false }).title).toBe(
      "Join a league on PostSzn Fantasy",
    );
  });
});

describe("withPreview", () => {
  it("swaps the head tags and escapes the league name", () => {
    const out = withPreview(
      html,
      previewText(invite),
      "https://x.test/join/A",
      "https://x.test/og.png",
    );
    expect(out).toContain("<title>Join Fam &lt;b&gt;League&lt;/b&gt; on PostSzn</title>");
    expect(out).toContain('property="og:image" content="https://x.test/og.png"');
    expect(out).toContain('name="twitter:card" content="summary_large_image"');
    expect(out).not.toContain("Generic.");
    expect(out.match(/og:title/g)).toHaveLength(1);
    expect(out).toContain('<div id="root">');
  });
});

describe("onRequest", () => {
  it("passes browsers straight to the app", async () => {
    const { ctx, next } = context("Mozilla/5.0 Safari/604.1");
    expect(await (await onRequest(ctx)).text()).toBe("spa");
    expect(next).toHaveBeenCalled();
  });
  it("gives crawlers the invite's card", async () => {
    const { ctx } = context("WhatsApp/2.23", Response.json(invite));
    const body = await (await onRequest(ctx)).text();
    expect(body).toContain("Join Fam &lt;b&gt;League&lt;/b&gt; on PostSzn");
    expect(body).toContain("3 open spots");
  });
  it("still answers with the generic card when the API fails", async () => {
    const { ctx } = context("WhatsApp/2.23");
    expect(await (await onRequest(ctx)).text()).toContain("Join a league on PostSzn Fantasy");
  });
});
