import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, Container, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useUserLeagues } from "../api/queries";
import { HOW_TO_PLAY_LABEL } from "../content/rules";
import { useSeasonContext } from "../contexts/SeasonContext";
import { useUser } from "../contexts/UserContext";
import { seasonPaths } from "../routes";
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

const Row = ({ to, title, hint }: { to: string; title: string; hint?: string }) => (
  <Box component={Link} to={to} sx={rowSx}>
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

/**
 * The More tab. Placeholder list of destinations; Settings and the rest are redesigned
 * in #267. Players is the Draft tab's league player list; the board has its own row.
 */
const MorePage = () => {
  const { leagueId, season, paths } = useSeasonContext();
  const { signOutUser } = useUser();
  const league = useUserLeagues(true).data?.find((item) => item.id === leagueId);
  const pastSeasons = (league?.seasons ?? []).filter((item) => !item.current).reverse();

  return (
    <Container maxWidth="sm" sx={{ pt: 2, pb: 3 }}>
      <Group label="League">
        {!season.isFormerMember && <Row to={paths.settings} title="Settings" />}
        <Row to={paths.draft} title="Players" hint="The league player list" />
        <Row to={paths.draftBoard} title="Draft board" />
        {season.canCommission && !season.finished && (
          <Row to={paths.home} title="Invite members" hint="Commissioner" />
        )}
      </Group>
      {pastSeasons.length > 0 && (
        <Group label="Past seasons">
          {pastSeasons.map((item) => (
            <Row
              key={item.id}
              to={seasonPaths(leagueId, item.year, false).home}
              title={`${item.year} season`}
            />
          ))}
        </Group>
      )}
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
    </Container>
  );
};

export default MorePage;
