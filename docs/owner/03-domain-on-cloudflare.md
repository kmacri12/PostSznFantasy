# Step 3: move the domain to Cloudflare

15 minutes of clicking, then a wait of minutes to a few hours. Issue #106 (part 1). [Back to the list](README.md) Screens checked 2026-10-30.

`postsznfantasy.com` is registered at Porkbun. Its **nameservers** (the address book that says where the domain lives) move to Cloudflare, so the website, the API address and email are all set up in one place. The domain stays registered at Porkbun.

**Start this first:** Steps 5, 7 and 9 need it.

1. Go to https://dash.cloudflare.com/sign-up, create a free account and verify your email.
2. Click **Add a domain** (it may say **Add a site**). Enter `postsznfantasy.com`. Choose the **Free** plan.
3. Cloudflare scans the existing records. Accept what it finds and click **Continue**.
4. Cloudflare shows two nameservers, like `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`. Keep that page open.
5. In another tab go to https://porkbun.com and sign in. Account menu (top right), **Domain Management**.
6. Find `postsznfantasy.com`, open its **Details**, and click the edit icon next to **Nameservers**.
7. Remove every existing entry and type the two Cloudflare nameservers, one per line. Click **Save Nameservers** (and **Submit** if it asks again).
8. Back in Cloudflare click **Done, check nameservers** (or **Check nameservers now**).

## Verify

`postsznfantasy.com` shows **Active** in the Cloudflare dashboard. Cloudflare also emails you when it is. From a terminal you can watch it:

```bash
dig +short NS postsznfantasy.com
```

It prints the two `ns.cloudflare.com` names when the move is done.

## If it goes wrong

- Still not Active after 24 hours: check for a typo in the nameservers at Porkbun. Porkbun says changes can take up to 48 hours.
- Porkbun warns that its email forwarding or web hosting will stop: the app uses neither. If you use Porkbun email forwarding for something else, tell the coordinator before saving.
