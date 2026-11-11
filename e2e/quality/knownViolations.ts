/**
 * Accessibility findings that are accepted for now, by axe rule id. `pages` lists where
 * the rule is waived as `<page>-<theme>` (e.g. `team-light`); every other rule, and every
 * other page, still fails the nightly run. Fix the page and delete the entry; never add
 * one without a reason and a tracking issue.
 */
export const KNOWN_VIOLATIONS: Record<string, { reason: string; pages: string[] }> = {
  "color-contrast": {
    reason:
      "Light theme: the standings rows' secondary text and the settings sections' captions are below 4.5:1 (found by the first nightly scan).",
    pages: ["league-after-draft-light", "settings-light"],
  },
};
