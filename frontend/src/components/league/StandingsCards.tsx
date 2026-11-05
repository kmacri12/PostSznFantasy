import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Card, Collapse, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { StandingsRow } from "../../api/types";
import { useSeasonContext } from "../../contexts/SeasonContext";
import { tokens } from "../../theme";
import { ROUND_LABELS } from "../team/lineup";
import ProgressCounts from "./ProgressCounts";
import RankCell from "./RankCell";
import { isOpenSpot, rankLabel, tieNote } from "./standingsView";

const ROUNDS = [
  { key: "wildCard", label: "Wild Card" },
  { key: "divisional", label: "Divisional" },
  { key: "confChamp", label: "Conference" },
  { key: "superBowl", label: "Super Bowl" },
] as const;

interface StandingsCardProps {
  row: StandingsRow;
  rank: string;
  note: string | null;
  round: number;
}

/** A team slot before the draft: nothing to expand, points are a dash. */
const SlotCard = ({ row, rank }: { row: StandingsRow; rank: string }) => {
  const { paths } = useSeasonContext();
  const open = isOpenSpot(row);
  return (
    <Card sx={{ p: 0 }}>
      <Box
        {...(open ? {} : { component: Link, to: paths.team(row.teamId) })}
        sx={{
          display: "flex",
          alignItems: "center",
          minHeight: 64,
          color: "inherit",
          textDecoration: "none",
        }}
      >
        <Box sx={{ pl: 0.5 }}>
          <RankCell label={rank} note={null} />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0, py: 1.5, pl: 0.5 }}>
          {open ? (
            <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
              Open spot
            </Typography>
          ) : (
            <>
              <Typography noWrap sx={{ fontWeight: 700 }}>
                {row.teamName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {row.owner}
                {row.isCommissioner && " · Commissioner"}
              </Typography>
            </>
          )}
        </Box>
        <Typography color="text.secondary" sx={{ pr: 2 }} aria-label="No points yet">
          –
        </Typography>
      </Box>
    </Card>
  );
};

const StandingsCard = ({ row, rank, note, round }: StandingsCardProps) => {
  const { paths } = useSeasonContext();
  const [open, setOpen] = useState(false);
  const panelId = `standings-${row.teamId}`;
  return (
    <Card sx={{ p: 0 }}>
      <Box sx={{ display: "flex", alignItems: "stretch" }}>
        <Box sx={{ display: "flex", alignItems: "center", pl: 0.5 }}>
          <RankCell label={rank} note={note} />
        </Box>
        <Box
          component="button"
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          sx={{
            all: "unset",
            boxSizing: "border-box",
            flexGrow: 1,
            minWidth: 0,
            minHeight: 64,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1.5,
            pr: 1.5,
            pl: 0.5,
            cursor: "pointer",
            "&:focus-visible": { outline: `2px solid ${tokens.accent}`, outlineOffset: -2 },
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700 }}>
              {row.teamName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {row.owner}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="h6" sx={{ color: tokens.accent, lineHeight: 1 }}>
              {row.total}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              pts
            </Typography>
          </Box>
          <ExpandMoreIcon
            aria-hidden
            sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
          />
        </Box>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box id={panelId} sx={{ px: 1.5, pb: 1.5, display: "grid", gap: 1.5 }}>
          {note && <Typography variant="body2">{note}</Typography>}
          <Box
            component="dl"
            sx={{ m: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.5 }}
          >
            {ROUNDS.map(({ key, label }) => (
              <Box key={key}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>
                  {row[key]}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography>
            Players left{" "}
            <Box component="span" sx={{ fontWeight: 700 }}>
              {row.playersLeft}
            </Box>
          </Typography>
          <Box>
            <Typography variant="overline" color="text.secondary" component="div">
              Starters · {ROUND_LABELS[round]}
            </Typography>
            <ProgressCounts progress={row.progress} />
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button component={Link} to={paths.teamPoints(row.teamId)} variant="outlined">
              Round-by-round points
            </Button>
            <Button component={Link} to={paths.team(row.teamId)}>
              View team
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Card>
  );
};

interface StandingsCardsProps {
  rows: StandingsRow[];
  round: number;
  /** Before the draft the rows are team slots, some of them open. */
  preDraft?: boolean;
}

const StandingsCards = ({ rows, round, preDraft = false }: StandingsCardsProps) => (
  <Box component="ol" aria-label="Standings" sx={{ display: "grid", gap: 1, m: 0, p: 0 }}>
    {rows.map((row, index) => (
      <Box component="li" key={row.teamId} sx={{ listStyle: "none" }}>
        {preDraft ? (
          <SlotCard row={row} rank={rankLabel(rows, index)} />
        ) : (
          <StandingsCard
            row={row}
            rank={rankLabel(rows, index)}
            note={tieNote(rows, index)}
            round={round}
          />
        )}
      </Box>
    ))}
  </Box>
);

export default StandingsCards;
