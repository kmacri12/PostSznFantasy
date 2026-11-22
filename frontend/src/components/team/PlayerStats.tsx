import { Box, Button, Drawer, Skeleton, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { usePlayerSeasonLine } from "../../api/queries";
import type { PointsBreakdownLine } from "../../api/types";
import { useBackClosesOverlay } from "../../hooks/useBackClosesOverlay";
import { useSwipeDismiss } from "../../hooks/useSwipeDismiss";
import { tokens } from "../../theme";
import InjuryTag from "../common/InjuryTag";
import TeamLogo from "../common/TeamLogo";
import { formatPoints } from "../league/standingsView";
import { ROUND_LABELS } from "./lineup";
import { seasonRows } from "./seasonLines";

/**
 * The player sheet's frame, shared by the Team page and the NFL schedule: name, position, team
 * and whatever the caller adds to that line, the round's points and game time, then the sections.
 */
export const PlayerDrawer = ({
  name,
  position,
  teamAbv,
  details,
  injuryStatus,
  points,
  when,
  onClose,
  children,
}: {
  name: string;
  position: string;
  teamAbv: string | null;
  /** What follows "QB · DET" on the line under the name. */
  details: string[];
  injuryStatus: string | null | undefined;
  points: string;
  when: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  useBackClosesOverlay(onClose);
  const swipe = useSwipeDismiss(onClose);
  return (
    <Drawer
      anchor="bottom"
      open
      onClose={onClose}
      slotProps={{
        paper: {
          "aria-label": name,
          ...swipe,
          sx: {
            maxWidth: 560,
            mx: "auto",
            width: "100%",
            borderRadius: "20px 20px 0 0",
            bgcolor: tokens.surface,
            borderTop: `1px solid ${tokens.borderStrong}`,
            backgroundImage: "none",
            px: 2,
            pt: 1.25,
            pb: "max(20px, env(safe-area-inset-bottom))",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            // dvh follows Safari's dynamic toolbar; vh is the fallback for older browsers.
            maxHeight: ["90vh", "90dvh"],
            overflow: "hidden",
          },
        },
      }}
    >
      <Box sx={{ width: 40, height: 4, borderRadius: 1, bgcolor: tokens.handle, mx: "auto" }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h2"
            sx={{ fontSize: 18, fontWeight: 700, overflowWrap: "anywhere" }}
          >
            {name}
          </Typography>
          <Typography component="span" sx={{ fontSize: 12, color: tokens.muted }}>
            {position} · <TeamLogo abbreviation={teamAbv} />
            {teamAbv || "FA"}
            {details.map((detail) => ` · ${detail}`).join("")}
          </Typography>
          <InjuryTag status={injuryStatus ?? null} />
        </Box>
        <Box sx={{ ml: "auto", textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{points}</Typography>
          <Typography component="span" sx={{ fontSize: 12, color: tokens.muted }}>
            {when}
          </Typography>
        </Box>
        <Button onClick={onClose} sx={{ minHeight: 44, minWidth: 44, flexShrink: 0 }}>
          Close
        </Button>
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {children}
      </Box>
    </Drawer>
  );
};

export interface StatRow {
  label: string;
  value: string;
  /** A second, smaller line under the label, e.g. that game's points. */
  note?: string;
  /** A total: bold label, a rule above. */
  strong?: boolean;
}

export const StatBox = ({ rows }: { rows: StatRow[] }) => (
  <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 3, overflow: "hidden" }}>
    {rows.map((row, index) => (
      <Box
        key={row.label}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 2,
          px: 1.5,
          py: 1,
          fontSize: 13,
          borderTop:
            index === 0 ? 0 : `1px solid ${row.strong ? tokens.borderStrong : tokens.border}`,
        }}
      >
        <Box
          component="span"
          sx={{
            color: row.strong ? tokens.text : tokens.muted,
            fontWeight: row.strong ? 700 : 400,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {row.label}
          {row.note && (
            <Box component="span" sx={{ display: "block", fontSize: 12, color: tokens.text }}>
              {row.note}
            </Box>
          )}
        </Box>
        <Box
          component="b"
          sx={{
            fontWeight: row.strong ? 700 : 600,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            // A long stat line wraps inside the sheet instead of widening it.
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          {row.value}
        </Box>
      </Box>
    ))}
  </Box>
);

/** One titled block of the sheet: This game, Postseason, Regular season. */
export const StatSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box component="section" aria-label={title}>
    <Typography component="h3" sx={{ fontSize: 12, color: tokens.muted, mb: 0.75 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

export interface GameLine {
  round: number;
  statLine: string | null;
  points: number;
  breakdown: PointsBreakdownLine[];
  multiplier: number;
}

/**
 * This game: the stat line, then how the points were made (one line per scoring stat), the
 * round multiplier when it is not 1, and the total.
 */
export const ThisGame = ({ game }: { game: GameLine }) => {
  const subtotal = game.breakdown.reduce((sum, line) => sum + line.points, 0);
  const rows: StatRow[] = [
    { label: ROUND_LABELS[game.round] ?? "This game", value: game.statLine ?? "No stats yet" },
    ...game.breakdown.map((line) => ({ label: line.label, value: formatPoints(line.points) })),
  ];
  if (game.breakdown.length > 0 && game.multiplier !== 1) {
    rows.push({ label: "Subtotal", value: formatPoints(subtotal), strong: true });
    rows.push({ label: `${ROUND_LABELS[game.round]} multiplier`, value: `×${game.multiplier}` });
  }
  rows.push({ label: "Fantasy points", value: formatPoints(game.points), strong: true });
  return (
    <StatSection title="This game">
      <StatBox rows={rows} />
    </StatSection>
  );
};

/** Earlier postseason games, oldest first, with each game's points under the round. */
export const Postseason = ({
  games,
}: {
  games: Pick<GameLine, "round" | "statLine" | "points">[];
}) =>
  games.length === 0 ? null : (
    <StatSection title="Postseason">
      <StatBox
        rows={games.map((game) => ({
          label: ROUND_LABELS[game.round] ?? `Round ${game.round}`,
          value: game.statLine ?? "No stats",
          note: `${formatPoints(game.points)} pts`,
        }))}
      />
    </StatSection>
  );

export const RegularSeason = ({ playerId, position }: { playerId: number; position: string }) => {
  const season = usePlayerSeasonLine(playerId);
  const rows = season.data ? seasonRows(position, season.data) : [];
  return (
    <StatSection title={season.data ? `${season.data.season} regular season` : "Regular season"}>
      {season.isPending ? (
        <Skeleton variant="rounded" height={64} />
      ) : (
        <StatBox
          rows={rows.length > 0 ? rows : [{ label: "Season", value: "No stats on record" }]}
        />
      )}
    </StatSection>
  );
};
