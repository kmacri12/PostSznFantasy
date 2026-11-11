// Every plain-language rule explanation in the app lives here, so it is easy to edit in one place.
// Wording follows GLOSSARY.md; the rules themselves are in docs/product-rules.md.

export interface HowToPlayRule {
  id: string;
  title: string;
  /** The one bold sentence that says the rule. */
  lead: string;
  /** Detail, one short paragraph per entry. */
  body: string[];
}

export interface HowToPlayGroup {
  id: string;
  title: string;
  rules: HowToPlayRule[];
}

export const HOW_TO_PLAY_TOUR_PROMPT = "Want the quick visual tour?";

export const HOW_TO_PLAY_GROUPS: HowToPlayGroup[] = [
  {
    id: "before-draft",
    title: "Before the draft",
    rules: [
      {
        id: "rounds",
        title: "The four rounds",
        lead: "The playoffs have four rounds, and your team scores in each one.",
        body: [
          "The rounds are Wild Card, Divisional, Conference Championship and the Super Bowl.",
          "Your team scores in every round it has a starter who plays. A round's score is added to your total.",
        ],
      },
      {
        id: "team-units",
        title: "Team QB and team K",
        lead: "With team QB or team K on, your slot scores every QB or K on that NFL team.",
        body: [
          "Your commissioner decides if team QB and team K are on. DST is always a team unit.",
          "With team QB on, you draft a QB by name, but the slot scores every QB on that NFL team in that game. Example: you draft Jalen Hurts and score every Eagles QB who plays. If a backup comes in, that QB counts too.",
          "Team K works the same way for kickers.",
          "The pool then lists one QB (or K) per NFL team, and the whole team leaves the pool when one is drafted. A wide receiver who throws a pass still scores as a WR.",
        ],
      },
      {
        id: "commissioner",
        title: "Commissioners",
        lead: "Your commissioner sets the rules and can fix a lineup, even after a lock.",
        body: [
          "Moving a locked player needs a confirmation, the league is told, and the slot is marked “changed by commissioner after kickoff”.",
          "Every override, stat correction and settings change goes in the activity feed.",
          "House rules and a welcome message go in the league notes.",
          "PostSzn is a free game played for fun. We do not handle, support, facilitate or help with anything related to money.",
        ],
      },
    ],
  },
  {
    id: "the-draft",
    title: "The draft",
    rules: [
      {
        id: "draft",
        title: "How the draft works",
        lead: "Your league drafts once, before the first Wild Card kickoff, and you can only pick players on the 14 playoff teams.",
        body: [
          "It is a snake draft: the order reverses every round.",
          "There are position caps. Once you reach a cap, that position is greyed out and tells you why. The commissioner sets the caps and your roster slots before the draft. They lock when the draft starts.",
        ],
      },
    ],
  },
  {
    id: "each-round",
    title: "Each round",
    rules: [
      {
        id: "lineups",
        title: "Lineups are set every round",
        lead: "After the draft, you place your players yourself, and again for each round.",
        body: [
          "Nothing is copied forward.",
          "Starters score. Bench players do not. An empty starter slot scores 0, so fill every slot.",
          "You can change a round's lineup any time before the players in it lock.",
        ],
      },
      {
        id: "locks",
        title: "Locks at kickoff",
        lead: "A player locks when their game kicks off, so set your lineup before then.",
        body: [
          "A player locks wherever they are: starter, flex or bench.",
          "A locked player cannot be moved, swapped or dropped.",
          "A player on a bye is still alive. They score 0 that round.",
        ],
      },
      {
        id: "eliminated",
        title: "Eliminated players",
        lead: "When a real team loses, its players are eliminated from the next round on.",
        body: [
          "Eliminated players move to the Eliminated section below your bench. They cannot be moved, and any slot they held is left empty.",
          "A Wild Card loser still counts for the Wild Card. They are eliminated from the Divisional on.",
          "“Players left” is how many players on your roster are still alive.",
        ],
      },
    ],
  },
  {
    id: "scoring-ties",
    title: "Scoring and ties",
    rules: [
      {
        id: "scoring",
        title: "Scoring",
        lead: "Players score from their real stats, and only points from starters count.",
        body: [
          "Your commissioner sets the scoring values. The League Settings page shows each one in plain words.",
          "Counted points are points a player scored while in a starter slot, times the round's multiplier. Only counted points go in your round score.",
          "Bench points are what players scored outside a starter slot. They never count. Your team page shows them so you can see what you left on the bench.",
          "A multiplier makes a round worth more or less. It is 1x in every round unless the commissioner changes it.",
          "Scores recompute when stats are corrected or settings change. Nobody edits scores by hand.",
        ],
      },
      {
        id: "ties",
        title: "Standings and ties",
        lead: "Your total is the sum of your round scores, and the highest total leads.",
        body: [
          "If two teams tie, the tie breaks in this order: the latest completed round's score, then the round before it, back to the Wild Card. If every round is level, the team with more rostered players on the Super Bowl winner ranks higher. If that is level too, they share the title.",
          "When a tie decided the order, tap or hover the rank to see why.",
        ],
      },
    ],
  },
];

/** One-line pointers shown on the pre-draft roster view and the lineup screen. */
export const LOCK_NOTE =
  "Players lock when their game starts. A locked player can't be moved, swapped or dropped.";
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
export const TEAM_QB_ON_NOTE = "Team QB is on: your QB scores every QB on that NFL team.";
export const TEAM_K_ON_NOTE = "Team K is on: your K scores every K on that NFL team.";

export const NOTES_TITLE = "Commissioner notes";
export const NOTES_EMPTY_MEMBER = "No notes yet.";
export const NOTES_EMPTY_COMMISSIONER = "Add house rules or a welcome message for your league.";
export const NOTES_HINT = "Everyone in the league can read this.";
export const NOTES_MAX_LENGTH = 5000;

export const HOW_TO_PLAY_LABEL = "How to play";

// The tour (components/tour): one captured screen per step, regenerated by `make tour`.
export const TOUR_LABEL = "Take the tour";
export const TOUR_TITLE = "PostSzn Fantasy in a minute";
export const TOUR_SKIP = "Skip";
export const TOUR_BACK = "Back";
export const TOUR_NEXT = "Next";
export const TOUR_DONE = "Got it";
export const TOUR_FOOTNOTE = "A real league\u2019s playoffs. Yours will look like this.";

export interface TourStep {
  /** Also the capture's file name: `public/tour/<id>.jpg`. */
  id: string;
  title: string;
  caption: string;
  /** A line set apart from the caption, for the one thing not to miss. */
  emphasis?: string;
  /** What the screen shows, for people who cannot see it. */
  alt: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "idea",
    title: "Fantasy for the playoffs only",
    caption:
      "Draft once. Set a lineup every round. When a real team loses, its players are out. One leaderboard crowns the champion.",
    alt: "The league standings during the playoffs: each team's total, this round's points and how many players it has left.",
  },
  {
    id: "draft",
    title: "Draft once",
    caption: "One draft before the first Wild Card kickoff, from players on the playoff teams.",
    emphasis: "Choose carefully: there are no waivers or free agency.",
    alt: "The draft board with the picks of a six-team draft.",
  },
  {
    id: "wild-card",
    title: "Set your lineup every round",
    caption:
      "Check your lineup before each round's kickoffs: byes, eliminations and injuries all change who should start.",
    alt: "A team page during Wild Card weekend with a full lineup, including players on a bye.",
  },
  {
    id: "eliminated",
    title: "Eliminations",
    caption:
      "When a real team loses, its players are eliminated. Your filled starting spots fade away throughout the playoffs.",
    alt: "A team page for a later round with empty starting spots and eliminated players listed below.",
  },
  {
    id: "feed",
    title: "The Feed",
    caption:
      "Chats and important updates in one place, with a dot on the tab when something is new.",
    alt: "The Feed: league updates followed by members chatting about their picks.",
  },
  {
    id: "champion",
    title: "A champion and awards",
    caption:
      "Points add up over all four rounds. After the Super Bowl, the team with the most total points wins. Awards honor the best players, picks and busts.",
    alt: "The finished season: the champion card, then the awards.",
  },
];

const ruleLead = (id: string, bodyIndex?: number): string => {
  for (const group of HOW_TO_PLAY_GROUPS) {
    const rule = group.rules.find((candidate) => candidate.id === id);
    if (rule) return bodyIndex === undefined ? rule.lead : `${rule.lead} ${rule.body[bodyIndex]}`;
  }
  throw new Error(`No How to play rule ${id}`);
};

// "?" popovers beside terms members get stuck on. The text is the matching How to play lead, so
// the two cannot drift; `ruleId` is the section its "Read more" link opens.
export interface HelpTipCopy {
  label: string;
  text: string;
  ruleId?: string;
}

export const HELP_TIPS = {
  lineupLocks: { label: "lineup locks", ruleId: "locks", text: ruleLead("locks") },
  eliminated: { label: "eliminated players", ruleId: "eliminated", text: ruleLead("eliminated") },
  draft: { label: "the draft and position caps", ruleId: "draft", text: ruleLead("draft", 1) },
  ties: { label: "standings and ties", ruleId: "ties", text: ruleLead("ties") },
} satisfies Record<string, HelpTipCopy>;

// Tooltips on commissioner settings. Keep each to a sentence or two.
export const SETTING_HELP = {
  teamQb:
    "On: you draft a QB by name, but the slot scores every QB on that NFL team in each game. Example: you draft Jalen Hurts and score every Eagles QB who plays. Off: a QB scores only that player.",
  teamK:
    "On: you draft a K by name, but the slot scores every K on that NFL team in each game. Example: you draft Jake Elliott and score every Eagles kicker who plays. Off: a K scores only that player.",
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

// Settings page copy.
export const NOTIFICATIONS_BLURB =
  "Allow notifications on this device, then choose below which ones you get. Signing out turns them off here. On iPhone, add the site to your Home Screen first.";
export const NOTIFICATION_KINDS = [
  {
    key: "draftAlerts",
    label: "Draft alerts",
    hint: "Your pick is on the clock, and the draft lobby and start.",
  },
  {
    key: "lineupReminders",
    label: "Lineup reminders",
    hint: "An hour before a round locks, if you have an empty starter slot.",
  },
  {
    key: "starterAlerts",
    label: "Hurt starters",
    hint: "A starter is ruled Out or Doubtful before his game locks.",
  },
  {
    key: "scoreAlerts",
    label: "Touchdowns",
    hint: "One of your starters scores. Bursts are grouped into one alert.",
  },
  {
    key: "roundResults",
    label: "Round results",
    hint: "How a round went and where you moved, or that your last player's team lost.",
  },
  {
    key: "mentions",
    label: "Mentions",
    hint: "Someone tags you with @ in a league chat, even if you muted that league.",
  },
  { key: "chat", label: "Chat messages", hint: "A message in any league you have not muted." },
] as const;
export const QUIET_HOURS = {
  label: "Quiet hours",
  hint: "No player alerts from 11pm to 7am, your local time. They still wait in the bell.",
} as const;
export const NOTIFICATIONS_IPHONE_STEPS = [
  "Open this site in Safari.",
  "Tap the Share button, then Add to Home Screen.",
  "Open the site from your Home Screen icon.",
  "Come back here and switch Notifications on.",
] as const;
export const NOTIFICATIONS_ANDROID_STEPS = [
  "Tap the switch, then Allow when Chrome asks.",
  "If you blocked it: Chrome menu, Settings, Site settings, Notifications, allow postsznfantasy.com; or long-press the app icon, App info, Notifications.",
] as const;
const numbered = (steps: readonly string[]) =>
  steps.map((step, index) => `${index + 1}. ${step}`).join(" ");
export const NOTIFICATIONS_ANDROID_HELP =
  "If notifications arrive late: Android Settings, Apps, Chrome, Battery, set to Unrestricted. Also turn off Battery Saver during the draft.";
export const NOTIFICATIONS_TIP = `On iPhone (iOS 16.4 or later): ${numbered(NOTIFICATIONS_IPHONE_STEPS)} On Android: ${numbered(NOTIFICATIONS_ANDROID_STEPS)} ${NOTIFICATIONS_ANDROID_HELP}`;
export const NOTIFICATIONS_STATUS_NOTE = {
  unsupported: "This browser can't show notifications.",
  unconfigured: "Notifications aren't available yet.",
  "needs-install":
    "On iPhone, add the site to your Home Screen and open it from the icon, then switch this on.",
} as const;
/** Only the person can unblock notifications, so each platform says where. */
export const NOTIFICATIONS_DENIED_HELP = {
  android:
    "Notifications are blocked. In Chrome open the menu, Settings, Site settings, Notifications and allow this site; or long-press the app icon, App info, Notifications.",
  ios: "Notifications are blocked. Open the iPhone Settings app, then Notifications, then PostSzn, and turn on Allow Notifications.",
  desktop:
    "Notifications are blocked. Click the icon at the left of the address bar and allow Notifications for this site.",
} as const;

// The one-time prompt offered after first sign-in and after joining a league.
export const OPT_IN_TITLE = "Get notified when it matters";
export const OPT_IN_WHY =
  "We'll tell you when your pick is on the clock and when lineups are about to lock. League chat stays quiet unless you turn it on in Profile settings.";
export const OPT_IN_TURN_ON = "Turn on notifications";
export const OPT_IN_NOT_NOW = "Not now";
export const OPT_IN_DONE = "Notifications are on";
export const OPT_IN_STEPS = {
  android: "Tap Turn on notifications, then Allow when Chrome asks.",
  ios: "Tap Turn on notifications, then Allow when your iPhone asks.",
  desktop: "Click Turn on notifications, then Allow in the browser popup.",
} as const;
export const OPT_IN_IPHONE_INSTALL =
  "On iPhone (iOS 16.4 or later), notifications work from the Home Screen app. In Safari tap Share, Add to Home Screen, open PostSzn from the new icon, then turn notifications on.";
export const OPT_IN_MANAGE =
  "You can change this any time in your profile settings (tap your avatar, top right), Notifications.";
// Offline, updates and install (#400).
export const OFFLINE_BANNER = "You're offline.";
export const offlineDataNote = (time: string | null): string =>
  time === null
    ? "Changes are turned off until you're back."
    : `Showing data from ${time}. Changes are turned off until you're back.`;
export const UPDATE_AVAILABLE = "Update available, tap to refresh";
export const UPDATE_OUTDATED = "PostSzn has been updated. Please refresh to keep going.";
export const UPDATE_REFRESH = "Refresh";
export const UPDATE_AVAILABLE_TITLE = "A new version of PostSzn is available";
export const ROUTE_ERROR_GENERIC_TITLE = "Something went wrong";
export const ROUTE_ERROR_GENERIC_BODY = "This page hit a problem. Try again, or head back home.";
export const ROUTE_ERROR_RETRY = "Try again";
export const ROUTE_ERROR_RETRY_TITLE = "PostSzn still can't load this page";
export const ROUTE_ERROR_RETRY_BODY = "Check your connection, then try again in a moment.";
export const ROUTE_ERROR_HOME = "Go home";

export const INSTALL_LABEL = "Install the app";
export const INSTALL_HINT = "Add PostSzn to your Home Screen";
export const INSTALL_TITLE = "Install PostSzn";
export const INSTALL_WHY =
  "Open PostSzn like any other app, straight from your Home Screen. On iPhone it is also what lets notifications reach you.";
export const INSTALL_NATIVE_BUTTON = "Install PostSzn";
export const INSTALL_NOT_NOW = "Not now";
export const INSTALL_DONE = "Got it";
export const INSTALL_IN_APP_BROWSER =
  "You're in another app's browser. Open this page in Safari (or Chrome on Android) first, then follow these steps.";
export const INSTALL_STEPS = {
  ios: [
    { icon: "share", text: "In Safari, tap the Share button at the bottom of the screen." },
    { icon: "add", text: "Scroll down and tap Add to Home Screen." },
    { icon: "open", text: "Tap Add, then open PostSzn from its new icon." },
  ],
  android: [
    { icon: "menu", text: "In Chrome, tap the menu (three dots) at the top right." },
    { icon: "add", text: "Tap Install app (or Add to Home screen)." },
    { icon: "open", text: "Confirm, then open PostSzn from its new icon." },
  ],
  desktop: [
    {
      icon: "add",
      text: "In Chrome or Edge, click the install icon at the right of the address bar.",
    },
    { icon: "open", text: "Click Install; PostSzn opens in its own window." },
  ],
} as const;
export const INSTALL_INSTALLED = "PostSzn is installed on this device.";

export const LAST_COMMISSIONER_NOTE =
  "A league always keeps at least one commissioner. Removing a member frees their team in an unfinished season; finished seasons keep their name on it.";

export const INVITE_RETIRED_NOTE =
  "The invite link was retired when you removed someone, so the old link no longer works. Regenerate it to invite people again.";
export const LEAVE_LEAGUE_NOTE =
  "Your team in an unfinished season is freed with its roster; finished seasons keep your name. You can rejoin later with a valid invite link.";
export const LEAVE_LAST_COMMISSIONER_NOTE =
  "You are the only commissioner. Make someone else a commissioner in the members list first, then you can leave.";

export const SUPPORT_LABEL = "Support PostSzn";
export const SUPPORT_HINT =
  "Enjoying PostSzn? Buy the developer a coffee. Optional, and it changes nothing in your league.";

export const REPORT_PROBLEM_LABEL = "Report a problem";
export const REPORT_PROBLEM_HINT = "Something broken or confusing? Tell us";
export const REPORT_PROBLEM_ATTACH_NOTE =
  "A screenshot and the diagnostic info each help. Including both gets it fixed faster.";
export const REPORT_PROBLEM_SENT = "Sent. We'll reply by email.";

export const FEEDBACK_LABEL = "Send feedback";
export const FEEDBACK_HINT = "How is PostSzn going? Tell us";
export const FEEDBACK_NOTE =
  "Everything here is optional. Feedback is sent without your name or email, so we can't reply to it. Use Report a problem if you want an answer.";
export const FEEDBACK_SENT = "Thanks, that helps.";

export const ACCOUNT_DELETION_SUMMARY =
  "Your sign-in, email, profile picture and notifications are deleted. Your leagues keep your past teams, picks and chat under the name Former member, and your teams in seasons still under way become open. If you are the only commissioner of a league with other members, hand it over first.";
