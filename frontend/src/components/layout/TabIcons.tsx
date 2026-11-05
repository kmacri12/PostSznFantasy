import { SvgIcon, type SvgIconProps } from "@mui/material";
import type { LeagueTabLabel } from "./leagueTabs";

/** The stroke icons from the mockups; MUI's filled set does not match them. */
const strokeIcon = (children: React.ReactNode) => (props: SvgIconProps) => (
  <SvgIcon
    {...props}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </SvgIcon>
);

export const TAB_ICONS: Record<LeagueTabLabel, (props: SvgIconProps) => React.ReactElement> = {
  League: strokeIcon(<path d="M4 6h16M4 12h16M4 18h10" />),
  Team: strokeIcon(
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
    </>,
  ),
  Draft: strokeIcon(
    <>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>,
  ),
  Feed: strokeIcon(<path d="M4 5h16v11H9l-5 4z" />),
  More: strokeIcon(
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>,
  ),
};
