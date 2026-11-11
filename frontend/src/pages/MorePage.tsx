import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, Container, Typography } from "@mui/material";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { useFeatures, useUserLeagues } from "../api/queries";
import AppToast from "../components/common/AppToast";
import InstallGuideSheet from "../components/install/InstallGuideSheet";
import { draftStatusLine } from "../components/league/draftStatusLine";
import InviteSheet from "../components/settings/InviteSheet";
import PastSeasonsSheet from "../components/settings/PastSeasonsSheet";
import ReportProblemSheet from "../components/support/ReportProblemSheet";
import TourDialog from "../components/tour/TourDialog";
import {
  HOW_TO_PLAY_LABEL,
  INSTALL_HINT,
  INSTALL_LABEL,
  REPORT_PROBLEM_HINT,
  REPORT_PROBLEM_LABEL,
  REPORT_PROBLEM_SENT,
  SUPPORT_HINT,
  SUPPORT_LABEL,
  TOUR_LABEL,
} from "../content/rules";
import { useSeasonContext } from "../contexts/SeasonContext";
import { useUser } from "../contexts/UserContext";
import { radii, tokens } from "../theme";
import { installKind, subscribeInstall } from "../utils/install";

const rowSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  minHeight: 56,
  px: 2,
  width: "100%",
  boxSizing: "border-box",
  borderTop: `1px solid ${tokens.border}`,
  "&:first-of-type": { borderTop: 0 },
  color: tokens.text,
  fontSize: 15,
  fontWeight: 500,
  textDecoration: "none",
  textAlign: "left",
  bgcolor: "transparent",
  border: 0,
  font: "inherit",
  cursor: "pointer",
} as const;

interface RowProps {
  title: string;
  hint?: string;
  /** A page to open; without it the row is a button that runs `onClick`. */
  to?: string;
  /** A third-party page, opened in a new tab. */
  href?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

const rowProps = ({ to, href, onClick }: Pick<RowProps, "to" | "href" | "onClick">) => {
  if (href) return { component: "a", href, target: "_blank", rel: "noopener noreferrer" };
  if (to) return { component: Link, to };
  return { component: "button", type: "button", onClick };
};

const Row = ({ to, href, icon, title, hint, onClick }: RowProps) => (
  <Box {...rowProps({ to, href, onClick })} sx={rowSx}>
    {icon}
    <span style={{ flex: 1 }}>
      {title}
      {hint && (
        <Typography component="small" sx={{ display: "block", fontSize: 12, color: tokens.muted }}>
          {hint}
        </Typography>
      )}
    </span>
    {href ? (
      <OpenInNewIcon sx={{ color: tokens.muted }} />
    ) : (
      <ChevronRightIcon sx={{ color: tokens.muted }} />
    )}
  </Box>
);

const Group = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <Typography sx={{ fontSize: 12, color: tokens.muted, px: 0.5, mt: 2, mb: 0.75 }}>
      {label}
    </Typography>
    <Box
      sx={{
        bgcolor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: `${radii.card}px`,
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  </>
);

/** The More tab: where the rest of the league lives, then help and the account. */
const MorePage = () => {
  const { leagueId, season, paths } = useSeasonContext();
  const { signOutUser } = useUser();
  const features = useFeatures();
  const league = useUserLeagues(true).data?.find((item) => item.id === leagueId);
  const pastSeasons = (league?.seasons ?? []).filter((item) => !item.current).reverse();
  const [sheet, setSheet] = useState<"past" | "invite" | "report" | "tour" | "install" | null>(
    null,
  );
  const [sent, setSent] = useState(false);
  const installed =
    useSyncExternalStore(subscribeInstall, installKind, () => "desktop" as const) === "installed";
  const supportUrl = import.meta.env.VITE_SUPPORT_URL?.trim();

  return (
    <Container maxWidth="sm" sx={{ pt: 2, pb: 3 }}>
      <Group label="League">
        <Row
          to={paths.draft}
          title={season.draftStatus === "completed" ? "Players" : "Draft room and players"}
          hint={draftStatusLine(season)}
        />
        {features.bracket && (
          <Row to={paths.bracket} title="NFL bracket" hint="Who plays whom, and your players" />
        )}
        <Row to={paths.draftBoard} title="Draft board" />
        {pastSeasons.length > 0 && (
          <Row
            title="Past seasons"
            hint={pastSeasons.map((item) => item.year).join(", ")}
            onClick={() => setSheet("past")}
          />
        )}
        {season.canCommission && !season.finished && (
          <Row title="Invite members" hint="Commissioner" onClick={() => setSheet("invite")} />
        )}
      </Group>
      <Group label="Help">
        <Row to={paths.howToPlay} title={HOW_TO_PLAY_LABEL} />
        <Row title={TOUR_LABEL} hint="A minute, in pictures" onClick={() => setSheet("tour")} />
        {installed ? null : (
          <Row title={INSTALL_LABEL} hint={INSTALL_HINT} onClick={() => setSheet("install")} />
        )}
        {supportUrl && (
          <Row
            href={supportUrl}
            icon={<LocalCafeIcon sx={{ color: tokens.muted }} />}
            title={SUPPORT_LABEL}
            hint={SUPPORT_HINT}
          />
        )}
        <Row
          title={REPORT_PROBLEM_LABEL}
          hint={REPORT_PROBLEM_HINT}
          onClick={() => setSheet("report")}
        />
      </Group>
      <Group label="Account">
        <Box
          component="button"
          type="button"
          onClick={signOutUser}
          sx={{ ...rowSx, color: tokens.redSoft }}
        >
          Sign out
        </Box>
      </Group>
      {sheet === "tour" && <TourDialog onClose={() => setSheet(null)} />}
      {sheet === "install" && <InstallGuideSheet onClose={() => setSheet(null)} />}
      {sheet === "past" && (
        <PastSeasonsSheet
          leagueId={leagueId}
          seasons={pastSeasons}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "invite" && <InviteSheet leagueId={leagueId} onClose={() => setSheet(null)} />}
      {sheet === "report" && (
        <ReportProblemSheet
          onClose={() => setSheet(null)}
          onSent={() => {
            setSheet(null);
            setSent(true);
          }}
        />
      )}
      <AppToast
        open={sent}
        message={REPORT_PROBLEM_SENT}
        autoHideMs={6000}
        onClose={() => setSent(false)}
      />
    </Container>
  );
};

export default MorePage;
