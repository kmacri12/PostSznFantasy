import LegalDocument, { type LegalSection } from "../components/common/LegalDocument";

const SECTIONS: LegalSection[] = [
  {
    heading: "What PostSzn is",
    body: [
      "PostSzn Fantasy is a free fantasy football game for the NFL postseason. You draft players, and as their real teams are eliminated, your players are too.",
    ],
  },
  {
    heading: "Free game, no money",
    body: [
      "PostSzn is a free game played for fun. Nothing is required to be bought, and the site offers no prizes of value and no real-money gaming.",
      "We do not handle, support, facilitate or help with anything related to money, including entry fees, buy-ins, prizes, wagering or payouts. If members of a league arrange anything of value among themselves, they do so entirely on their own, they alone are responsible for it and for following the laws that apply to them, and PostSzn takes no part in it. Void where prohibited.",
    ],
  },
  {
    heading: "Using the site",
    body: [
      "Be decent to other players, and do not try to break, overload or get around the site. We may remove accounts or leagues that do.",
    ],
  },
  {
    heading: "Provided as is",
    body: [
      "The site comes as is, without promises. Scores and player data come from third parties and may be late or wrong, and the site may go down or change at any time. We are not liable for losses from using it.",
    ],
  },
  {
    heading: "Not affiliated with the NFL",
    body: [
      "PostSzn is an independent project. It is not affiliated with or endorsed by the NFL or any team.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "We may update these terms and will change the date on this page when we do. Using the site afterward means you accept them. This page is a plain-language description, not legal advice.",
    ],
  },
];

const TermsPage = () => (
  <LegalDocument title="Terms of Service" updated="November 2026" sections={SECTIONS} />
);

export default TermsPage;
