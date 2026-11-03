import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import type React from "react";
import { Link } from "react-router-dom";
import { useStandings } from "../../api/queries";
import type { Standings, StandingsRow } from "../../api/types";
import { useSeasonContext } from "../../contexts/SeasonContext";
import { tokens } from "../../theme";
import QueryBoundary from "../common/QueryBoundary";
import { ROUND_LABELS } from "../team/lineup";
import LiveSummary from "./LiveSummary";
import ProgressCounts from "./ProgressCounts";
import RankCell from "./RankCell";
import StandingsCards from "./StandingsCards";
import { isOpenSpot, PROGRESS_ITEMS, preDraftLine, rankLabel, tieNote } from "./standingsView";

const RANK_COLORS = [tokens.gold, "#cbd5e1", "#d97706"];

const RoundBadge = ({ points }: { points: number }) => (
  <Chip
    size="small"
    label={points}
    variant={points > 0 ? "filled" : "outlined"}
    sx={{
      minWidth: 52,
      bgcolor: points > 0 ? "rgba(34,211,238,.14)" : "transparent",
      color: points > 0 ? tokens.cyan : tokens.muted,
    }}
  />
);

const StandingsTable: React.FC = () => {
  const { seasonId, paths } = useSeasonContext();
  const query = useStandings(seasonId);
  return (
    <QueryBoundary
      query={query}
      what="standings"
      isEmpty={(standings) => standings.teams.length === 0}
      empty={{
        title: "No standings yet",
        description: "Standings appear once the playoffs begin and scores are in.",
        action: (
          <Button component={Link} to={paths.draft} variant="outlined">
            Open the draft room
          </Button>
        ),
      }}
    >
      {(standings) => <StandingsRows standings={standings} />}
    </QueryBoundary>
  );
};

const Legend = () => (
  <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 0 }}>
    Starters this round: {PROGRESS_ITEMS.map((item) => `${item.label} (${item.hint})`).join(" · ")}
  </Typography>
);

const TableRows = ({ rows, round }: { rows: StandingsRow[]; round: number }) => {
  const { paths } = useSeasonContext();
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell width={72}>#</TableCell>
            <TableCell>Team</TableCell>
            <TableCell align="center">Players left</TableCell>
            <TableCell align="center">Wild Card</TableCell>
            <TableCell align="center">Divisional</TableCell>
            <TableCell align="center">Conf</TableCell>
            <TableCell align="center">Super Bowl</TableCell>
            <TableCell>Starters · {ROUND_LABELS[round]}</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell width={56} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.teamId} hover>
              <TableCell sx={{ p: 0 }}>
                <RankCell
                  label={rankLabel(rows, index)}
                  note={tieNote(rows, index)}
                  color={RANK_COLORS[(row.rank ?? 0) - 1] ?? tokens.muted}
                />
              </TableCell>
              <TableCell>
                <Box
                  component={Link}
                  to={paths.team(row.teamId)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <Avatar
                    sx={{ width: 32, height: 32, bgcolor: tokens.borderStrong, fontSize: 14 }}
                  >
                    {row.teamName[0]}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {row.teamName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.owner}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
              <TableCell align="center">
                <Chip
                  size="small"
                  color={row.playersLeft > 0 ? "success" : "default"}
                  label={row.playersLeft}
                  variant="outlined"
                  aria-label={`${row.playersLeft} players left`}
                />
              </TableCell>
              <TableCell align="center">
                <RoundBadge points={row.wildCard} />
              </TableCell>
              <TableCell align="center">
                <RoundBadge points={row.divisional} />
              </TableCell>
              <TableCell align="center">
                <RoundBadge points={row.confChamp} />
              </TableCell>
              <TableCell align="center">
                <RoundBadge points={row.superBowl} />
              </TableCell>
              <TableCell>
                <ProgressCounts progress={row.progress} compact />
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 800, fontSize: 18 }}>
                {row.total}
              </TableCell>
              <TableCell sx={{ p: 0 }}>
                <Tooltip title="Round-by-round points">
                  <IconButton
                    component={Link}
                    to={paths.teamPoints(row.teamId)}
                    aria-label={`Round-by-round points for ${row.teamName}`}
                  >
                    <TimelineIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const SlotRows = ({ rows }: { rows: StandingsRow[] }) => {
  const { paths } = useSeasonContext();
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell width={72}>#</TableCell>
            <TableCell>Team</TableCell>
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.teamId}>
              <TableCell sx={{ p: 0 }}>
                <RankCell label={rankLabel(rows, index)} note={null} />
              </TableCell>
              <TableCell>
                {isOpenSpot(row) ? (
                  <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
                    Open spot
                  </Typography>
                ) : (
                  <Box
                    component={Link}
                    to={paths.team(row.teamId)}
                    sx={{ color: "inherit", textDecoration: "none" }}
                  >
                    <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {row.teamName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.owner}
                      {row.isCommissioner && " · Commissioner"}
                    </Typography>
                  </Box>
                )}
              </TableCell>
              <TableCell align="right" sx={{ color: "text.secondary" }}>
                –
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const PreDraftRows = ({ standings }: { standings: Standings }) => (
  <>
    <Typography sx={{ fontWeight: 700, mb: 1 }}>{preDraftLine(standings.teams)}</Typography>
    <Box sx={{ display: { xs: "block", md: "none" } }}>
      <StandingsCards rows={standings.teams} round={standings.round} preDraft />
    </Box>
    <Box sx={{ display: { xs: "none", md: "block" } }}>
      <SlotRows rows={standings.teams} />
    </Box>
  </>
);

const StandingsRows = ({ standings }: { standings: Standings }) => {
  if (standings.phase === "pre_draft") return <PreDraftRows standings={standings} />;
  const rows = [...standings.teams].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  return (
    <>
      <LiveSummary standings={standings} />
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <StandingsCards rows={rows} round={standings.round} />
      </Box>
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <TableRows rows={rows} round={standings.round} />
        <Legend />
      </Box>
    </>
  );
};

export default StandingsTable;
