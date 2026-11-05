import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";
import { API_URL, RESEND_STUB_URL } from "../support/env";

const MB = 1024 * 1024;
// The first bytes make these real PNGs as far as the API's content check goes.
const PNG_HEADER = Buffer.from("89504e470d0a1a0a", "hex");
const png = (bytes = 64) => Buffer.concat([PNG_HEADER, Buffer.alloc(bytes)]);

interface SentEmail {
  authorization: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  attachments: { filename: string; content: string }[];
}

const sentEmails = async (request: APIRequestContext): Promise<SentEmail[]> =>
  (await request.get(`${RESEND_STUB_URL}/sent`)).json();

const resetProvider = (request: APIRequestContext) => request.delete(`${RESEND_STUB_URL}/sent`);

const failProvider = (request: APIRequestContext, status: number) =>
  request.put(`${RESEND_STUB_URL}/mode`, { data: { status } });

const setup = async (
  page: Page,
  context: Parameters<typeof signInAs>[0],
  request: APIRequestContext,
) => {
  const member = new Api(request, unique("report"));
  await member.signUp("reporter");
  const league = await member.createLeague(unique("Support League"));
  await signInAs(context, member.uid);
  await resetProvider(request);
  await page.goto(seasonUrl(league, "/more"));
  await page.getByRole("button", { name: /^Report a problem/ }).click();
  const sheet = page.getByRole("dialog", { name: "Report a problem" });
  await expect(sheet).toBeVisible();
  return { member, league, sheet };
};

test.describe("report a problem", () => {
  test("sends the message, screenshots and diagnostics to support", async ({
    page,
    context,
    request,
  }) => {
    const { member, league, sheet } = await setup(page, context, request);

    await sheet.getByRole("textbox", { name: /What went wrong/ }).fill("The board is blank");
    await sheet.getByLabel("Choose images").setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: png() },
      { name: "two.png", mimeType: "image/png", buffer: png() },
    ]);
    await expect(sheet.getByText("2 of 5 images, 0.0 MB of 15.0 MB")).toBeVisible();

    await sheet.getByRole("button", { name: "What's included" }).click();
    await expect(sheet.getByLabel("Diagnostic info as sent")).toContainText(
      `/leagues/${league.leagueId}/more`,
    );

    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Sent. We'll reply by email.")).toBeVisible();
    await expect(sheet).toHaveCount(0);

    const [email] = await sentEmails(request);
    expect(email?.authorization).toBe("Bearer re_e2e_stub");
    expect(email?.to).toEqual(["support@e2e.test"]);
    expect(email?.reply_to).toBe(`${member.uid}@e2e.test`);
    expect(email?.text).toContain("The board is blank");
    expect(email?.text).toContain(`"leagueId": ${league.leagueId}`);
    expect(email?.text).not.toContain("Bearer");
    expect(email?.text).not.toContain("e2e-user:");
    expect(email?.attachments.map((item) => item.filename)).toEqual([
      "screenshot-1.png",
      "screenshot-2.png",
    ]);
  });

  test("leaves the diagnostics out when the box is unticked", async ({
    page,
    context,
    request,
  }) => {
    const { sheet } = await setup(page, context, request);

    await sheet.getByRole("textbox", { name: /What went wrong/ }).fill("Just a note");
    await sheet.getByRole("checkbox", { name: "Include diagnostic info" }).uncheck();
    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Sent. We'll reply by email.")).toBeVisible();

    const [email] = await sentEmails(request);
    expect(email?.text).toContain("left it out");
    expect(email?.text).not.toContain('"device"');
  });

  test("refuses a large image and a non-image inline, before sending", async ({
    page,
    context,
    request,
  }) => {
    const { sheet } = await setup(page, context, request);
    const picker = sheet.getByLabel("Choose images");

    await picker.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: png(7 * MB) });
    await expect(sheet.getByRole("alert")).toContainText(
      "That image is 7.0 MB. The limit is 5.0 MB per image.",
    );
    await expect(sheet.getByText("0 of 5 images, 0.0 MB of 15.0 MB")).toBeVisible();

    await picker.setInputFiles({
      name: "notes.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7"),
    });
    await expect(sheet.getByRole("alert")).toContainText("isn't an image");

    await picker.setInputFiles(
      [1, 2, 3, 4].map((n) => ({ name: `${n}.png`, mimeType: "image/png", buffer: png(4 * MB) })),
    );
    await expect(sheet.getByRole("alert")).toContainText("in total");
    await expect(sheet.getByText("3 of 5 images, 12.0 MB of 15.0 MB")).toBeVisible();
    expect(await sentEmails(request)).toEqual([]);
  });

  test("shows the API's message for a file that only looks like an image", async ({
    page,
    context,
    request,
  }) => {
    const { sheet } = await setup(page, context, request);

    await sheet.getByRole("textbox", { name: /What went wrong/ }).fill("Check this");
    await sheet.getByLabel("Choose images").setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("%PDF-1.7 pretending"),
    });
    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await expect(sheet.getByText("Attachment 1 is not an image.")).toBeVisible();
    expect(await sentEmails(request)).toEqual([]);
  });

  test("keeps the message when sending fails and works on a second try", async ({
    page,
    context,
    request,
  }) => {
    const { sheet } = await setup(page, context, request);
    await failProvider(request, 500);

    await sheet.getByRole("textbox", { name: /What went wrong/ }).fill("Still broken");
    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await expect(sheet.getByText(/couldn't send your report/i)).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: /What went wrong/ })).toHaveValue(
      "Still broken",
    );
    expect(await sentEmails(request)).toEqual([]);

    await resetProvider(request);
    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Sent. We'll reply by email.")).toBeVisible();
    expect(await sentEmails(request)).toHaveLength(1);
  });

  test("the sixth report in an hour is turned away with a clear message", async ({
    page,
    context,
    request,
  }) => {
    const { member, sheet } = await setup(page, context, request);
    const send = async (message: string) => {
      const response = await request.post(`${API_URL}/api/support`, {
        headers: { Authorization: `Bearer e2e-user:${member.uid}` },
        multipart: { message },
      });
      return response.status();
    };
    for (let n = 1; n <= 5; n++) expect(await send(`Report ${n}`)).toBe(204);

    await sheet.getByRole("textbox", { name: /What went wrong/ }).fill("Number six");
    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await expect(sheet.getByText(/5 reports in the last hour/)).toBeVisible();
    expect(await sentEmails(request)).toHaveLength(5);
  });
});
