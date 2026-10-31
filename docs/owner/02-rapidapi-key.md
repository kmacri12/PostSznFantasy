# Step 2: RapidAPI account and Tank01 key

About 10 minutes. Issue #71. [Back to the list](README.md)

Tank01 (sold through RapidAPI) is where the NFL stats come from.

1. Go to https://rapidapi.com and sign up or sign in.
2. Search for `Tank01 NFL Live In-Game Real Time Statistics` and open it. Its host is `tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com`.
3. Open the **Pricing** tab and compare with what we planned (you confirmed these on 2026-10-30; the page needs a login, so it could not be rechecked automatically):
   - **Basic**: free, 1,000 requests a month, hard cap.
   - **Pro**: $10 a month, 1,000 requests a day, then $0.01 each.

   If the numbers differ, tell the coordinator before going further: the app's daily cap (700) is built on them.
4. Click **Subscribe** on **Basic** (no card).
5. Open the **Endpoints** tab and click any endpoint. The code sample on the right shows `X-RapidAPI-Key`. Copy that value into your password manager as **RapidAPI Tank01 key**.
6. Add two calendar reminders:
   - first week of January: upgrade to **Pro** before Wild Card weekend
   - the day after the Super Bowl: go back to **Basic**

## Verify

- The key is in your password manager.
- Both calendar reminders exist.

Then close #71 if it is still open.

## If it goes wrong

The API is not found, or Basic is not offered: paste what the Pricing tab shows to the coordinator.
