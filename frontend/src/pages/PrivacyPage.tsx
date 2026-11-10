import LegalDocument, { type LegalSection } from "../components/common/LegalDocument";

const SECTIONS: LegalSection[] = [
  {
    heading: "What we store",
    body: [
      "When you sign in with Google or an emailed one-time code, we keep your email address and, if Google provides it, your name. Sign-in is handled by Supabase.",
      "We also store what you do in the game: the leagues you create or join, your team and roster, your draft picks and queue, league settings, and the chat messages and GIF links you post in a league's Feed (each message keeps the name you had when you posted it).",
      "If you turn on notifications, we store your browser's push address and browser type for that device so we can send them. They are removed when you turn notifications off or sign out on that device, and a device that has not opened the app in 60 days is removed too.",
    ],
  },
  {
    heading: "Who is allowed to use PostSzn",
    body: ["You must be at least 13 years old to use PostSzn."],
  },
  {
    heading: "Error reports",
    body: [
      "If the app crashes or an error occurs, a report may be sent to Sentry so we can fix it. We work to keep personal information such as your email out of these reports.",
    ],
  },
  {
    heading: "Counting visits",
    body: [
      "We count visits with Cloudflare Web Analytics, which sets no cookies and does not follow you across other sites. We also keep totals such as signups, leagues and drafts to see how the game is used; these totals never include your email or name.",
    ],
  },
  {
    heading: "Reporting a problem",
    body: [
      "More, Report a problem emails your message, any screenshots you attach and your account email to support@postsznfantasy.com, so we can reply. Diagnostic info (the page you were on, league, season and team ids, your device and browser, recent app errors and failed requests) is included only while its box is ticked, and you can read it before sending. It never includes passwords, sign-in tokens or chat messages. We do not keep the files on our servers; they live in the support inbox and in the email provider (Resend) that delivers it. You can also write to support@postsznfantasy.com directly.",
    ],
  },
  {
    heading: "Pictures",
    body: [
      "If you set a profile, team or league picture, the cropped image is stored in a private storage bucket run for us by Supabase. Anyone in your leagues can see a picture that appears in a league (your profile picture, your team's picture and the league's picture); someone who is not in your leagues cannot find it without its address. We re-save every uploaded picture at a small size, which also drops any location or camera information embedded in the original. Removing a picture deletes the file from storage; a browser that already loaded it may keep showing its own copy for up to a day.",
    ],
  },
  {
    heading: "GIFs",
    body: [
      "If you open the GIF picker in the chat, your browser sends the search text and your IP address directly to GIPHY, which has its own privacy policy. Nothing is sent to GIPHY unless you open the picker.",
    ],
  },
  {
    heading: "What we do not do",
    body: [
      "We do not sell your data, share it with advertisers, or show ads. We only share it with the services that run the app (sign-in and picture storage: Supabase; hosting: Fly.io and Cloudflare; error reporting: Sentry; support email: Resend; GIFs: GIPHY, only when you use the picker).",
    ],
  },
  {
    heading: "Who can see your information",
    body: [
      "Other members of your leagues can see your team name, roster and standings. Your email address is not shown to other players.",
    ],
  },
  {
    heading: "Deleting your data",
    body: [
      "You can stop using PostSzn at any time. To delete your account, open your profile (tap your picture), then Delete my account. Your sign-in, email, profile picture and notification settings are deleted right away. Your leagues keep your past teams, picks and chat under the name Former member so other members' history still makes sense, and your teams in seasons still under way become open. If you are the only commissioner of a league with other members, hand it over first.",
      "We keep encrypted backups of the database for a limited time; your data ages out of them as they are replaced. If you cannot use the app, write to support@postsznfantasy.com and we will delete your account within 30 days.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "If this policy changes, we will update this page and its date. This page is a plain-language description, not legal advice.",
    ],
  },
];

const PrivacyPage = () => (
  <LegalDocument title="Privacy Policy" updated="November 2026" sections={SECTIONS} />
);

export default PrivacyPage;
