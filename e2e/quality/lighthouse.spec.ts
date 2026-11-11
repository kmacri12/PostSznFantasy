import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, expect, test } from "@playwright/test";
import budgets from "../lighthouse/budget.json" with { type: "json" };
import { seasonUrl } from "../support/api";
import { stubToken } from "../support/auth";
import { createDraftLeague } from "../support/draft";
import { SESSION_STORAGE_KEY } from "../support/env";

// Nightly Lighthouse budget (mobile profile, simulated slow 4G) on the landing page and a
// league page, against the production build the main suite uses. Lighthouse lives in its
// own package (e2e/lighthouse) so pull request jobs never install it. Lighthouse 12 has no
// PWA score: installability is covered by e2e/tests/install-offline.spec.ts, and the
// manifest and service worker audits stay in "best-practices" and "performance".

const DEBUG_PORT = 9333;
type Category = "performance" | "accessibility" | "best-practices" | "seo";
const CATEGORIES: Category[] = ["performance", "accessibility", "best-practices", "seo"];

interface LighthouseResult {
  lhr: {
    categories: Record<string, { score: number | null }>;
    audits: Record<string, { numericValue?: number }>;
  };
}
type Runner = (
  url: string,
  flags: Record<string, unknown>,
) => Promise<LighthouseResult | undefined>;

const loadLighthouse = async (): Promise<Runner> => {
  const entry = new URL("../lighthouse/node_modules/lighthouse/core/index.js", import.meta.url);
  return (await import(entry.href)).default as Runner;
};

test("landing and league pages stay within the Lighthouse budget", async ({
  playwright,
  baseURL,
}) => {
  const WEB_URL = baseURL ?? "";
  test.setTimeout(300_000);
  const request = await playwright.request.newContext();
  const league = await createDraftLeague(request, {
    seconds: 60,
    status: "in_progress",
    leagueName: "Lighthouse League",
  });
  await request.dispose();
  const uid = league.host.uid;
  const run = await loadLighthouse();

  // A persistent context is the browser's default one, which the page Lighthouse opens shares.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "postszn-lh-"));
  const context = await chromium.launchPersistentContext(profile, {
    args: [`--remote-debugging-port=${DEBUG_PORT}`],
  });
  try {
    const page = await context.newPage();
    await page.goto(WEB_URL);

    const measure = async (url: string) => {
      const result = await run(url, {
        port: DEBUG_PORT,
        output: "json",
        logLevel: "error",
        onlyCategories: CATEGORIES,
        disableStorageReset: true,
      });
      if (!result) throw new Error(`Lighthouse returned nothing for ${url}`);
      return result.lhr;
    };

    const scores: Record<string, Record<string, number>> = {};
    const timings: Record<string, Record<string, number>> = {};
    const record = (name: string, lhr: LighthouseResult["lhr"]) => {
      scores[name] = Object.fromEntries(
        CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]),
      );
      timings[name] = {
        "largest-contentful-paint": lhr.audits["largest-contentful-paint"]?.numericValue ?? 0,
        "total-blocking-time": lhr.audits["total-blocking-time"]?.numericValue ?? 0,
        "cumulative-layout-shift": lhr.audits["cumulative-layout-shift"]?.numericValue ?? 0,
      };
    };

    // Signed out first: the stored session would redirect the landing page.
    record("landing", await measure(`${WEB_URL}/`));

    await page.evaluate(
      ([key, token, id]) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: token,
            refresh_token: "e2e-refresh",
            token_type: "bearer",
            expires_in: 3_153_600_000,
            expires_at: Math.floor(Date.now() / 1000) + 3_153_600_000,
            user: {
              id,
              aud: "authenticated",
              role: "authenticated",
              email: `${id}@e2e.test`,
              app_metadata: {},
              user_metadata: { full_name: id },
              created_at: "2026-01-01T00:00:00Z",
            },
          }),
        ),
      [SESSION_STORAGE_KEY, stubToken(uid), uid] as const,
    );
    record("league", await measure(`${WEB_URL}${seasonUrl(league.league)}`));

    console.log(JSON.stringify({ scores, timings }, null, 2));
    for (const [name, budget] of Object.entries(budgets)) {
      for (const category of CATEGORIES) {
        expect(
          scores[name]?.[category],
          `${name} ${category} score (budget ${budget.scores[category]})`,
        ).toBeGreaterThanOrEqual(budget.scores[category]);
      }
      for (const [audit, max] of Object.entries(budget.maxMilliseconds)) {
        expect(timings[name]?.[audit], `${name} ${audit} (budget ${max})`).toBeLessThanOrEqual(max);
      }
      expect(
        timings[name]?.["cumulative-layout-shift"],
        `${name} cumulative-layout-shift (budget ${budget.maxLayoutShift})`,
      ).toBeLessThanOrEqual(budget.maxLayoutShift);
    }
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
