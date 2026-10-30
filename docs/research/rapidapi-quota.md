# RapidAPI Tank01 NFL quota (issue #71, 5.1)

Researched 2026-10-29, read-only: no paid API call was made and no credentials were used.

## Bottom line

- The believed "1,000 per month" is right for the **free Basic plan only**, and it is a **hard cap** (no overage).
- The **paid** tiers switch to a **per-day** quota, starting at **Pro: $10/month, 1,000 requests/day**, then $0.01 per extra request.
- With a 30% safety margin the free plan gives **700 usable calls per month**, below the ~800-call postseason target. Free is therefore not enough on its own; **Pro for January is justified** (700 usable calls/day, and the monthly total stops mattering).
- Recommendation: stay on Basic through the December launch (a full seed is ~35 calls), upgrade to Pro when the January playoffs begin, and cancel after the Super Bowl.

## Plans

Source: Tank01's own site, <https://www.tank01.com/> ("Each plan is specific to a sports league"; NFL is its own RapidAPI subscription).

| Plan | Price | Quota | Overage |
| :-- | :-- | :-- | :-- |
| Basic | Free, no credit card | 1,000 hits **per month**, hard cap | none (requests stop) |
| Pro | $10/month | 1,000 requests **per day** | $0.01 each |
| Ultra | $25/month | 15,000 requests per day | $0.01 each |
| Mega | $100/month | 500,000 requests per day (125,000 for NHL/WNBA) | $0.01 each |

Caveats:

- The RapidAPI listing's Pricing tab is JavaScript-rendered and could not be read by tooling, so the NFL listing's own figures were **not** independently confirmed there. The tank01.com page is the owner's statement and applies to all leagues. Kyle should glance at the pricing tab of the NFL listing before subscribing (the wizard-free check is in "Confirming" below).
- Pro's daily quota means a month's total is not capped at 1,000. Unspent daily calls do not carry over.

## Budget vs. target

| Scenario | Quota | 30% margin applied | Fits ~800 target? |
| :-- | :-- | :-- | :-- |
| Basic (monthly) | 1,000 / month | 700 / month | No: 800 > 700 |
| Pro (daily) | 1,000 / day | 700 / day | Yes, if no single day needs more than 700 |

Playoff days are the risk on Pro: live polling is the main spender (one box score call per live game per poll; `SCHEDULER_LIVE_POLL_SECONDS` defaults to 90 s, so one 3-hour game is ~120 calls). Four games in a day is ~480 with polling, under 700. Confirm when tuning the poll interval.

## Confirming remaining quota

Every response from the API carries these headers (RapidAPI docs, <https://docs.rapidapi.com/v2.0.0/docs/response-headers>):

| Header | Meaning |
| :-- | :-- |
| `x-ratelimit-requests-limit` | Static: requests the current plan allows before overage |
| `x-ratelimit-requests-remaining` | Requests remaining from the plan before the limit |
| `x-ratelimit-requests-reset` | Seconds until the quota resets |
| `x-rate-limit-rapid-free-plans-hard-limit-limit` / `-remaining` / `-reset` | Free plans on rapidapi.com only: monthly cap, remaining, and seconds left in the month |

Already wired in this repo: `RapidApiClient._record_quota` reads `x-ratelimit-requests-remaining`, logs it (warning when low), and `make seed` prints it. `docs/rapidapi-tank01.md` notes the same two headers. The free-plan hard-limit headers are not read by the client; on Basic they are the authoritative monthly figure.

Other places to check by hand: RapidAPI dashboard, app analytics for the Tank01 NFL API (usage graph), and the listing's Pricing tab (plan names, limits, which one is "current").

## Open items for Kyle

1. Open the NFL listing's Pricing tab and confirm Basic is still 1,000/month and Pro is still $10 for 1,000/day.
2. Check the current plan and the remaining count after the next `make seed` (the end-of-seed output).
3. Decide the January upgrade date (before Wild Card weekend, 2027).
