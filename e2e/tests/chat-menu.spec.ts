import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("the chat message menu", () => {
  test("right-click opens it: react, reply, edit and delete a message", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("chat-host"));
    await host.signUp("chathost");
    const league = await host.createLeague(unique("Chat League"));
    const guest = new Api(request, unique("chat-guest"));
    await guest.signUp("chatguest");
    await guest.joinWith(await host.invite(league));
    await guest.post(`/api/seasons/${league.seasonId}/messages`, { body: "who has the first pick" });
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/feed"));
    await expect(page.getByText("who has the first pick", { exact: true })).toBeVisible();

    // React with a quick emoji: the chip shows the count and the menu closes.
    await page.getByText("who has the first pick", { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: "React with 🔥", exact: true }).click();
    await expect(page.getByRole("button", { name: /^🔥 1, chathost/ })).toBeVisible();

    // Reply: the quote shows above the box and the answer carries it.
    await page.getByText("who has the first pick", { exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Reply", exact: true }).click();
    await expect(page.getByText("Replying to chatguest: who has the first pick")).toBeVisible();
    await page.getByRole("combobox", { name: "Message the league" }).fill("I do");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(page.getByText("I do", { exact: true })).toBeVisible();

    // Edit and delete your own message.
    await page.getByText("I do", { exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.getByRole("combobox", { name: "Message the league" }).fill("I do, obviously");
    await page.getByRole("button", { name: "Save edit", exact: true }).click();
    await expect(page.getByText("I do, obviously", { exact: true })).toBeVisible();
    await expect(page.getByText("edited", { exact: true })).toBeVisible();

    await page.getByText("I do, obviously", { exact: true }).click({ button: "right" });
    await page.getByRole("button", { name: "Delete message from You", exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("I do, obviously", { exact: true })).toHaveCount(0);
  });

  test("a mention reaches the tagged member's inbox", async ({ request }) => {
    const host = new Api(request, unique("mention-host"));
    await host.signUp("mentionhost");
    const league = await host.createLeague(unique("Mention League"));
    const guest = new Api(request, unique("mention-guest"));
    const guestId = await guest.signUp("mentionguest");
    await guest.joinWith(await host.invite(league));

    await host.post(`/api/seasons/${league.seasonId}/messages`, {
      body: "hello @mentionguest",
      mentionedUserIds: [guestId],
    });

    await expect
      .poll(async () => {
        const inbox = await guest.get<{ items: { kind: string }[] }>("/api/notifications");
        return inbox.items.map((item) => item.kind);
      })
      .toContain("mention");
  });
});
