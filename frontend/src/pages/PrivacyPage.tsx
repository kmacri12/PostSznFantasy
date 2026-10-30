import LegalDocument, { type LegalSection } from "../components/common/LegalDocument";

const SECTIONS: LegalSection[] = [
  {
    heading: "What we store",
    body: [
      "When you sign in with Google or an emailed magic link, we keep your email address and, if Google provides it, your name. Sign-in is handled by Supabase.",
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
    heading: "What we do not do",
    body: [
      "We do not sell your data, share it with advertisers, or show ads. We only share it with the services that run the app (sign-in, hosting and error reporting).",
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
