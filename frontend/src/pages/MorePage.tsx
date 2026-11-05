import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, Container, Typography } from "@mui/material";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useUserLeagues } from "../api/queries";
import { draftStatusLine } from "../components/league/draftStatusLine";
import InviteSheet from "../components/settings/InviteSheet";
import PastSeasonsSheet from "../components/settings/PastSeasonsSheet";
import { HOW_TO_PLAY_LABEL } from "../content/rules";
import { useSeasonContext } from "../contexts/SeasonContext";
import { useUser } from "../contexts/UserContext";
import { radii, tokens } from "../theme";

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
  onClick?: () => void;
}

const Row = ({ to, title, hint, onClick }: RowProps) => (
  <Box
    {...(to ? { component: Link, to } : { component: "button", type: "button", onClick })}
    sx={rowSx}
  >
    <span>
      {title}
      {hint && (
        <Typography component="small" sx={{ display: "block", fontSize: 12, color: tokens.muted }}>
          {hint}
        </Typography>
      )}
    </span>
    <ChevronRightIcon sx={{ color: tokens.muted }} />
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
  const league = useUserLeagues(true).data?.find((item) => item.id === leagueId);
  const pastSeasons = (league?.seasons ?? []).filter((item) => !item.current).reverse();
  const [sheet, setSheet] = useState<"past" | "invite" | null>(null);

  return (
    <Container maxWidth="sm" sx={{ pt: 2, pb: 3 }}>
      <Group label="League">
        {!season.isFormerMember && (
          <Row
            to={paths.settings}
            title="Settings"
            hint="Your settings and commissioner settings"
          />
        )}
        <Row to={paths.players} title="Players" hint={draftStatusLine(season)} />
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
        <Row to="/how-to-play" title={HOW_TO_PLAY_LABEL} />
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
      {sheet === "past" && (
        <PastSeasonsSheet
          leagueId={leagueId}
          seasons={pastSeasons}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "invite" && <InviteSheet leagueId={leagueId} onClose={() => setSheet(null)} />}
    </Container>
  );
};

export default MorePage;
