# Step 25: Form the company (LLC)

A few evenings, then waiting: the state filing takes days to weeks and the D-U-N-S number up to about 30 days. Part of the [native apps plan](../mobile/README.md) (not started). Start at least 3 months before the target launch. [Back to the list](README.md)

Both store accounts will belong to this company, not to you personally: the stores then show the company as the seller, Google skips its 12-tester rule for organization accounts, and the company is what carries the legal risk. One **umbrella** LLC is planned: it owns PostSzn and anything you build later. A product can move into its own LLC later if it grows.

This page is a checklist, not legal or tax advice. Ask the lawyer from [Step 30](30-legal-review.md) or an accountant where your state differs.

## Name ideas

Not tied to PostSzn, so the company outlives any one product. Before choosing, check each: your state's business-name search, the USPTO trademark search (tmsearch.uspto.gov), the `.com` domain, and how it reads as "Seller: ___ LLC" on an App Store page.

1. **KMac Labs**: your handle, short, says "makes things".
2. **Macri Works**: your surname, plain and durable.
3. **Kestrel Works**: K for Kyle, a small fast bird; unique and easy to say.
4. **Off By One Labs**: the oldest programming joke; memorable to developers.
5. **Hot Reload Studio**: the moment code changes on screen without a restart.
6. **Late Night Commit**: when side projects actually get built.
7. **Small Batch Software**: small, carefully made products.
8. **Null Island Labs**: the map point at 0°, 0° where bad data lands; odd and memorable.
9. **Side Quest Software**: every product starts as a side quest.
10. **Bright Fork**: a fork, the way new projects start.

## Steps

1. **Pick the state.** Usually your home state: forming elsewhere means registering in your state anyway. Note its filing fee and yearly fee.
2. **File the LLC** with the state (Articles of Organization). Choose a registered agent (yourself at home, or a paid agent if you'd rather not publish your address).
3. **Write a short operating agreement**, even for a single member. Banks and the lawyer will ask.
4. **Get an EIN** from the IRS website (free, minutes).
5. **Open a business bank account** for the $99 and $25 store fees, the domain and the lawyer. Keep company spending on it.
6. **Get a D-U-N-S number** (free). Use Apple's D-U-N-S lookup in the developer enrollment pages first: it says whether one exists and requests one if not. The legal name and address must match the state filing exactly.
7. **Company domain and one-page website**: Apple's organization enrollment checks for a public website on a domain associated with the company. One page with the company name, contact email and a link to PostSzn is enough. Cloudflare Pages hosts it free, like PostSzn.
8. **A company email** on that domain (for example through Cloudflare Email Routing to your inbox). Use it for the store accounts.
9. Tell the coordinator the exact legal name: it goes into the Privacy Policy and Terms ([workstream 05](../mobile/workstreams/05-legal.md)).

## Verify

- You have the state's approval, the EIN letter and a D-U-N-S number whose name and address match the filing.
- The company website loads on its own domain.
