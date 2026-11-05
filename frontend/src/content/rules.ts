// Every plain-language rule explanation in the app lives here, so it is easy to edit in one place.
// Wording follows GLOSSARY.md; the rules themselves are in docs/product-rules.md.

export interface HowToPlaySection {
  id: string;
  title: string;
  /** One short paragraph per entry. */
  body: string[];
}

export const HOW_TO_PLAY_INTRO =
  "Draft once before the Wild Card round. Then set a new lineup every round. When a real team loses, its players are eliminated. One leaderboard crowns the champion.";

export const HOW_TO_PLAY_SECTIONS: HowToPlaySection[] = [
  {
    id: "rounds",
    title: "The four rounds",
    body: [
      "The playoffs have four rounds: Wild Card, Divisional, Conference Championship and the Super Bowl.",
      "Your team scores in every round it has a starter who plays. A round's score is added to your total.",
    ],
  },
  {
    id: "draft",
    title: "The draft",
    body: [
      "Your league drafts once, before the first Wild Card kickoff. It is a snake draft: the order reverses every round.",
      "You can only draft players on the 14 playoff teams.",
      "There are position caps. Once you reach a cap, that position is greyed out and tells you why. The commissioner sets the caps and your roster slots before the draft. They lock when the draft starts.",
    ],
  },
  {
    id: "lineups",
    title: "Lineups are set every round",
    body: [
      "After the draft, nobody is in a lineup. You place your players yourself, and again for each round. Nothing is copied forward.",
      "Starters score. Bench players do not. An empty starter slot scores 0, so fill every slot.",
      "You can change a round's lineup any time before the players in it lock.",
    ],
  },
  {
    id: "locks",
    title: "Locks at kickoff",
    body: [
      "A player locks when their game kicks off, wherever they are: starter, flex or bench.",
      "A locked player cannot be moved, swapped or dropped. Set your lineup before kickoff.",
      "A player on a bye is still alive. They score 0 that round.",
    ],
  },
  {
    id: "eliminated",
    title: "Eliminated players",
    body: [
      "When a real team loses, its players are eliminated from the next round on.",
      "Eliminated players move to the Eliminated section below your bench. They cannot be moved, and any slot they held is left empty.",
      "A Wild Card loser still counts for the Wild Card. They are eliminated from the Divisional on.",
      "“Players left” is how many players on your roster are still alive.",
    ],
  },
  {
    id: "team-units",
    title: "Team QB and team K",
    body: [
      "Your commissioner decides if team QB and team K are on. DST is always a team unit.",
      "With team QB on, you draft a QB by name, but the slot scores every QB on that NFL team in that game. Example: you draft Jalen Hurts and score every Eagles QB who plays. If a backup comes in, he counts too.",
      "Team K works the same way for kickers.",
      "The pool then lists one QB (or K) per NFL team, and the whole team leaves the pool when one is drafted. A wide receiver who throws a pass still scores as a WR.",
    ],
  },
  {
    id: "scoring",
    title: "Scoring",
    body: [
      "Players score from their real stats. Your commissioner sets the scoring values. The League Settings page shows each one in plain words.",
      "Counted points are points a player scored while in a starter slot, times the round's multiplier. Only counted points go in your round score.",
      "Bench points are what players scored outside a starter slot. They never count. Your team page shows them so you can see what you left on the bench.",
      "A multiplier makes a round worth more or less. It is 1x in every round unless the commissioner changes it.",
      "Scores recompute when stats are corrected or settings change. Nobody edits scores by hand.",
    ],
  },
  {
    id: "ties",
    title: "Standings and ties",
    body: [
      "Your total is the sum of your round scores. The highest total leads.",
      "If two teams tie, the tie breaks in this order: the latest completed round's score, then the round before it, back to the Wild Card. If every round is level, the team with more rostered players on the Super Bowl winner ranks higher. If that is level too, they share the title.",
      "When a tie decided the order, tap or hover the rank to see why.",
    ],
  },
  {
    id: "commissioner",
    title: "Commissioners",
    body: [
      "A commissioner can edit any lineup, even after a lock. Moving a locked player needs a confirmation, the league is told, and the slot is marked “changed by commissioner after kickoff”.",
      "Every override, stat correction and settings change goes in the activity feed.",
      "The app does not handle money. Buy-in, prizes and house rules go in the league notes.",
    ],
  },
];

/** One-line pointers shown on the pre-draft roster view and the lineup screen. */
export const LOCK_NOTE =
  "Players lock at their game's kickoff. A locked player can't be moved, swapped or dropped.";
export const LOCK_NOTE_OVERRIDE = " As commissioner you can move them, after you confirm.";

export const PRE_DRAFT_TITLE = "Plan your draft";
export const PRE_DRAFT_INTRO =
  "Your roster is empty until the draft. This is what you will be able to fill.";
export const PRE_DRAFT_RULES: string[] = [
  "Nobody is in a lineup after the draft. You place your players, round by round.",
  "Only starters score. An empty starter slot scores 0.",
  LOCK_NOTE,
  "When a real team loses, its players are eliminated from the next round on.",
  "Roster slots and caps lock when the draft starts.",
];
export const PRE_DRAFT_UNLIMITED = "No limit";
export const TEAM_QB_ON_NOTE = "Team QB is on: your QB scores every QB on his NFL team.";
export const TEAM_K_ON_NOTE = "Team K is on: your K scores every K on his NFL team.";

export const NOTES_TITLE = "Commissioner notes";
export const NOTES_EMPTY_MEMBER = "No notes yet.";
export const NOTES_EMPTY_COMMISSIONER =
  "Add buy-in, prizes or house rules for your league. The app does not handle any money.";
export const NOTES_HINT = "Everyone in the league can read this. The app does not handle money.";
export const NOTES_MAX_LENGTH = 5000;

export const HOW_TO_PLAY_LABEL = "How to play";

// Tooltips on commissioner settings. Keep each to a sentence or two.
export const SETTING_HELP = {
  teamQb:
    "On: you draft a QB by name, but he scores every QB on his NFL team in each game. Example: you draft Jalen Hurts and score every Eagles QB who plays. Off: a QB scores only himself.",
  teamK:
    "On: you draft a K by name, but he scores every K on his NFL team in each game. Example: you draft Jake Elliott and score every Eagles kicker who plays. Off: a K scores only himself.",
  multiplier:
    "Multiplies every starter's points in this round. 1x leaves scores as they are, 2x doubles them. Bench points use it too, so they compare directly.",
  allowJoin:
    "Lets new members join a team after the draft has started. Otherwise joining closes at draft start.",
  numberTeams: "How many fantasy teams are in the league, 2 to 14. It locks when the draft starts.",
  rosterStarters:
    "How many players of each position start each round. Only starters score. A FLEX takes any of the positions in its brackets. These lock when the draft starts.",
  rosterBench:
    "Bench players do not score, but can move into a starter slot before they lock. Slots plus bench make the roster size, which is also the number of draft rounds.",
  rosterLimits:
    "The most players of one position a team may draft. At the cap, that position is greyed out in the draft pool. With team QB or team K on, the cap counts different NFL teams. Caps lock when the draft starts.",
  scoring:
    "Points per stat. Under each value you see what it means in plain words. Scoring stays editable after the draft and every score recomputes.",
  lockedAtDraftStart: "Locked: the draft has started, so this can no longer change.",
} as const;
