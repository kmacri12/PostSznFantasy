import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  Collapse,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStandings } from "../../api/queries";
import type { SeasonOverview, Standings as StandingsData, StandingsRow } from "../../api/types";
import { HELP_TIPS } from "../../content/rules";
import { useSeasonContext } from "../../contexts/SeasonContext";
import { tint, tokens } from "../../theme";
import HelpTip from "../common/HelpTip";
import PictureAvatar from "../common/PictureAvatar";
import QueryBoundary from "../common/QueryBoundary";
import ShareCardButton from "../share/ShareCardButton";
import { roundCard } from "../share/shareCards";
import RankCell from "./RankCell";
import { formatPoints, isOpenSpot, ROUNDS, rankLabel, rowDetail, tieNote } from "./standingsView";

const PLACE_COLORS = [tokens.gold, "grey.400", "warning.dark"];

const placeColor = (row: StandingsRow, finished: boolean) =>
  finished ? PLACE_COLORS[(row.rank ?? 0) - 1] : undefined;

/** The current-round color, shared by the header chip, the badge and the round cell. */
const currentRoundColor = tokens.accent;

const Badge = ({ children }: { children: string }) => (
  <Box
    component="span"
    sx={{
      display: "inline-block",
      px: 0.75,
      borderRadius: 1.5,
      fontSize: 12,
      fontWeight: 600,
      color: currentRoundColor,
      bgcolor: tint(tokens.accent, 12),
      border: `1px solid ${tint(tokens.accent, 45)}`,
    }}
  >
    {children}
  </Box>
);

const CardHeader = ({ finished }: { finished: boolean }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25 }}>
    <Typography component="h2" sx={{ flexGrow: 1, fontSize: 14, fontWeight: 700 }}>
      {finished ? "Final standings" : "Standings"}
    </Typography>
    <Box sx={{ my: -1.25, mr: -1 }}>
      <HelpTip {...HELP_TIPS.ties} />
    </Box>
    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Total</Typography>
    {!finished && <Badge>This rd</Badge>}
  </Box>
);

interface RowProps {
  row: StandingsRow;
  rows: StandingsRow[];
  index: number;
  round: number;
  finished: boolean;
}

/** Round points for the expanded row: the current round outlined, rounds to come a dash. */
const RoundTable = ({ row, round, finished }: Pick<RowProps, "row" | "round" | "finished">) => (
  <Box
    component="dl"
    sx={{ m: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.75 }}
  >
    {ROUNDS.map(({ key, label }, i) => {
      const current = !finished && i + 1 === round;
      const upcoming = !finished && i + 1 > round;
      return (
        <Box
          key={key}
          sx={{
            border: 1,
            borderColor: current ? currentRoundColor : "divider",
            borderRadius: 1,
            py: 0.75,
            textAlign: "center",
            bgcolor: "background.paper",
          }}
        >
          <Typography component="dt" sx={{ fontSize: 10, color: "text.secondary" }}>
            {label}
          </Typography>
          <Typography component="dd" sx={{ m: 0, fontSize: 15, fontWeight: 600 }}>
            {upcoming ? "-" : formatPoints(row[key])}
          </Typography>
        </Box>
      );
    })}
  </Box>
);

const PhoneRow = ({
  row,
  rows,
  index,
  round,
  finished,
  open,
  onToggle,
}: RowProps & { open: boolean; onToggle: () => void }) => {
  const { paths } = useSeasonContext();
  const note = tieNote(rows, index);
  const color = placeColor(row, finished);
  const currentKey = ROUNDS[round - 1]?.key ?? "wildCard";
  const panelId = `standings-${row.teamId}`;
  return (
    <Box component="li" sx={{ listStyle: "none", borderTop: 1, borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "stretch" }}>
        <Box sx={{ display: "flex", alignItems: "center", pl: 0.5 }}>
          <RankCell label={rankLabel(rows, index)} note={note} color={color ?? tokens.muted} />
        </Box>
        <Box
          component="button"
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          sx={{
            all: "unset",
            boxSizing: "border-box",
            flexGrow: 1,
            minWidth: 0,
            minHeight: 64,
            display: "flex",
            alignItems: "center",
            gap: 1,
            py: 1.25,
            pr: 1.5,
            pl: 0.5,
            cursor: "pointer",
            "&:focus-visible": { outline: `2px solid ${tokens.accent}`, outlineOffset: -2 },
          }}
        >
          <PictureAvatar url={row.teamAvatarUrl} name={row.teamName} size={36} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 600, color }}>
              {row.teamName}
            </Typography>
            <Typography variant="caption" component="div" sx={{ color: color ?? "text.secondary" }}>
              {rowDetail(row, !finished)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color }}>
              {formatPoints(row.total)}
            </Typography>
            {!finished && <Badge>{formatPoints(row[currentKey])}</Badge>}
          </Box>
          <ExpandMoreIcon
            aria-hidden
            fontSize="small"
            sx={{
              color: "text.secondary",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .2s",
            }}
          />
        </Box>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box
          id={panelId}
          sx={{ px: 2, pt: 1.25, pb: 1.5, display: "grid", gap: 1.25, bgcolor: "action.hover" }}
        >
          {note && <Typography variant="body2">{note}</Typography>}
          <RoundTable row={row} round={round} finished={finished} />
          <Button
            component={Link}
            to={paths.team(row.teamId)}
            variant="outlined"
            color="inherit"
            fullWidth
          >
            Open team page
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
};

const PhoneList = ({ rows, round, finished }: Omit<RowProps, "row" | "index">) => {
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <Box component="ol" aria-label="Standings" sx={{ m: 0, p: 0 }}>
      {rows.map((row, index) => (
        <PhoneRow
          key={row.teamId}
          row={row}
          rows={rows}
          index={index}
          round={round}
          finished={finished}
          open={openId === row.teamId}
          onToggle={() => setOpenId(openId === row.teamId ? null : row.teamId)}
        />
      ))}
    </Box>
  );
};

const DesktopTable = ({ rows, round, finished }: Omit<RowProps, "row" | "index">) => {
  const { paths } = useSeasonContext();
  return (
    <Table aria-label="Standings">
      <TableHead>
        <TableRow>
          <TableCell width={72}>#</TableCell>
          <TableCell>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              Team
              <Box sx={{ my: -1.5 }}>
                <HelpTip {...HELP_TIPS.ties} />
              </Box>
            </Box>
          </TableCell>
          {ROUNDS.map(({ key, short }, i) => (
            <TableCell
              key={key}
              align="right"
              sx={!finished && i + 1 === round ? { color: currentRoundColor } : undefined}
            >
              {short}
            </TableCell>
          ))}
          <TableCell align="right">Total</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => {
          const color = placeColor(row, finished);
          return (
            <TableRow key={row.teamId} hover>
              <TableCell sx={{ p: 0 }}>
                <RankCell
                  label={rankLabel(rows, index)}
                  note={tieNote(rows, index)}
                  color={color ?? tokens.muted}
                />
              </TableCell>
              <TableCell>
                <Box
                  component={Link}
                  to={paths.team(row.teamId)}
                  sx={{
                    color: "inherit",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                  }}
                >
                  <PictureAvatar url={row.teamAvatarUrl} name={row.teamName} size={32} />
                  <Box>
                    <Typography sx={{ fontWeight: 600, color }}>{row.teamName}</Typography>
                    <Typography variant="caption" sx={{ color: color ?? "text.secondary" }}>
                      {rowDetail(row, !finished)}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
              {ROUNDS.map(({ key }, i) => {
                const current = !finished && i + 1 === round;
                return (
                  <TableCell
                    key={key}
                    align="right"
                    sx={{
                      color: current ? currentRoundColor : "text.primary",
                      fontWeight: current ? 600 : 400,
                    }}
                  >
                    {!finished && i + 1 > round ? "-" : formatPoints(row[key])}
                  </TableCell>
                );
              })}
              <TableCell align="right" sx={{ fontSize: 20, fontWeight: 700, color }}>
                {formatPoints(row.total)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

/** Before the draft: the team slots, with the owner or an open slot. */
const SlotList = ({ rows, season }: { rows: StandingsRow[]; season: SeasonOverview }) => {
  const { paths } = useSeasonContext();
  const scheduled = season.draftStatus !== "unscheduled";
  const filled = rows.filter((row) => !isOpenSpot(row)).length;
  return (
    <Paper component="section" aria-label="Teams" sx={{ overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1.25 }}>
        <Typography component="h2" sx={{ flexGrow: 1, fontSize: 14, fontWeight: 700 }}>
          {scheduled ? "Standings" : "Teams"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {scheduled ? "Total" : `${filled} of ${rows.length} filled`}
        </Typography>
      </Box>
      <Box component="ol" aria-label="Standings" sx={{ m: 0, p: 0 }}>
        {rows.map((row, index) => {
          const open = isOpenSpot(row);
          return (
            <Box
              component="li"
              key={row.teamId}
              sx={{
                listStyle: "none",
                borderTop: 1,
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                minHeight: 64,
                gap: 1,
                px: 2,
              }}
            >
              <Typography sx={{ width: 28, color: "text.secondary", fontSize: 13 }}>
                {scheduled ? 1 : index + 1}
              </Typography>
              <PictureAvatar
                url={open ? null : row.teamAvatarUrl}
                name={open ? "?" : row.teamName}
                size={36}
              />
              <Box
                {...(open ? {} : { component: Link, to: paths.team(row.teamId) })}
                sx={{ flexGrow: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}
              >
                <Typography
                  noWrap
                  sx={{ fontWeight: open ? 500 : 600, color: open ? "text.secondary" : undefined }}
                >
                  {open ? "Open slot" : row.teamName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {rowDetail(row, false)}
                </Typography>
              </Box>
              {scheduled && (
                <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{open ? "-" : "0.0"}</Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};

const LiveStandings = ({
  standings,
  finished,
}: {
  standings: StandingsData;
  finished: boolean;
}) => {
  const rows = [...standings.teams].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const shared = { rows, round: standings.round, finished };
  return (
    <Paper
      component="section"
      aria-label={finished ? "Final standings" : "Standings"}
      sx={{ overflow: "hidden" }}
    >
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <CardHeader finished={finished} />
        <PhoneList {...shared} />
      </Box>
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <DesktopTable {...shared} />
      </Box>
    </Paper>
  );
};

/** Every team of the season, ranked once the draft is done. Shown in every phase. */
const Standings = ({ season }: { season: SeasonOverview }) => {
  const { paths } = useSeasonContext();
  const query = useStandings(season.id);
  return (
    <QueryBoundary
      query={query}
      what="standings"
      isEmpty={(standings) => standings.teams.length === 0}
      empty={{
        title: "No teams yet",
        description: "Teams appear here once the league has them.",
        action: (
          <Button component={Link} to={paths.draft} variant="outlined">
            Open the draft room
          </Button>
        ),
      }}
    >
      {(standings) =>
        standings.phase === "pre_draft" ? (
          <SlotList rows={standings.teams} season={season} />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <LiveStandings standings={standings} finished={season.finished} />
            {/* The finished season's recap carries the champion card instead. */}
            {!season.finished && (
              <ShareCardButton
                card={roundCard(season.leagueName, season.year, standings)}
                label="Share round result"
              />
            )}
          </Box>
        )
      }
    </QueryBoundary>
  );
};

export default Standings;
