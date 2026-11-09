import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

const TOUR = "PostSzn Fantasy in a minute";

test.describe("first-run tour", () => {
  test("shows once after joining by link, can be skipped, and reopens from More", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Tour League"));
    const code = await host.invite(league);
    await signInAs(context, unique("newcomer"));

    await page.goto(`/join/${code}`);
    await page.getByRole("button", { name: "Join league" }).click();
    const tour = page.getByRole("dialog", { name: TOUR });
    await expect(
      tour.getByRole("heading", { name: "Fantasy for the playoffs only" }),
    ).toBeVisible();
    await expect(tour.getByRole("img", { name: /league standings/ })).toBeVisible();
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByRole("heading", { name: "Invite your league" })).toBeVisible();
    await tour.getByRole("button", { name: "Skip" }).click();
    await expect(tour).toBeHidden();

    await page.reload();
    await expect(
      page.getByText("Invite your friends").or(page.getByText("Draft not yet")),
    ).toBeVisible();
    await expect(tour).toBeHidden();

    await page.goto(seasonUrl(league, "/more"));
    await page.getByRole("button", { name: "Take the tour" }).click();
    for (let step = 0; step < 6; step++) await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByRole("heading", { name: "A champion and awards" })).toBeVisible();
    await tour.getByRole("button", { name: "Got it" }).click();
    await expect(tour).toBeHidden();
  });

  test("shows after creating a league, and is on How to play and the invite page", async ({
    page,
    context,
    request,
  }) => {
    const uid = unique("creator");
    await new Api(request, uid).signUp("creator");
    await signInAs(context, uid);

    await page.goto("/create-league");
    await page.getByLabel("League name").fill(unique("Created Tour"));
    await page.getByRole("button", { name: "Create league" }).click();
    await expect(page.getByRole("dialog", { name: TOUR })).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();

    await page.goto("/how-to-play");
    const inline = page.getByRole("region", { name: TOUR });
    await expect(
      inline.getByRole("heading", { name: "Fantasy for the playoffs only" }),
    ).toBeVisible();
    await inline.getByRole("button", { name: "Next" }).click();
    await expect(inline.getByRole("heading", { name: "Invite your league" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The four rounds" })).toBeVisible();
  });

  test("a signed-out invite visitor can watch it before signing in", async ({ page, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Invite Tour"));
    const code = await host.invite(league);

    await page.goto(`/join/${code}`);
    await page.getByRole("button", { name: "Take the tour" }).click();
    const tour = page.getByRole("dialog", { name: TOUR });
    await expect(tour).toBeVisible();
    await tour.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("link", { name: "Sign in to join" })).toBeVisible();
  });
});
