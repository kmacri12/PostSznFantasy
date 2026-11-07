import LegalDocument, { type LegalSection } from "../components/common/LegalDocument";

const SECTIONS: LegalSection[] = [
  {
    heading: "What we store",
    body: [
      "When you sign in with Google or an emailed one-time code, we keep your email address and, if Google provides it, your name. Sign-in is handled by Supabase.",
      "We also store what you do in the game: the leagues you create or join, your team and roster, your draft picks and queue, and league settings.",
    ],
  },
  {
    heading: "Error reports",
    body: [
      "If the app crashes or an error occurs, a report may be sent to Sentry so we can fix it. We work to keep personal information such as your email out of these reports.",
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
      "If you set a profile, team or league picture, the cropped image is stored in a private storage bucket run for us by Supabase. Anyone in your leagues can see a picture that appears in a league (your profile picture, your team's picture and the league's picture); someone who is not in your leagues cannot find it without its address. Removing a picture deletes the file.",
    ],
  },
  {
    heading: "What we do not do",
    body: [
      "We do not sell your data, share it with advertisers, or show ads. We only share it with the services that run the app (sign-in, hosting, error reporting and support email).",
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
      "You can stop using PostSzn at any time. To have your account and league data deleted, ask the person who runs this site.",
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
  <LegalDocument title="Privacy Policy" updated="October 2026" sections={SECTIONS} />
);

export default PrivacyPage;
