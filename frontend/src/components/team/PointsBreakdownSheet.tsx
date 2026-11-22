import { Box } from "@mui/material";
import { Fragment } from "react";
import type { LineupPlayer } from "../../api/types";
import { formatPoints } from "../league/standingsView";
import SettingsSheet from "../settings/SettingsSheet";
import { ROUND_LABELS } from "./lineup";

interface Props {
  player: LineupPlayer;
  round: number;
  multiplier: number;
  onClose: () => void;
}

/** One line per scoring stat ("17 rushing yards 1.7"), then the round multiplier and the total. */
const PointsBreakdownSheet = ({ player, round, multiplier, onClose }: Props) => {
  // An API from before the breakdown sends none.
  const lines = player.pointsBreakdown ?? [];
  const subtotal = lines.reduce((sum, line) => sum + line.points, 0);
  const rows: { label: string; value: string; strong?: boolean }[] = lines.map((line) => ({
    label: line.label,
    value: formatPoints(line.points),
  }));
  if (multiplier !== 1) {
    rows.push({ label: "Subtotal", value: formatPoints(subtotal), strong: true });
    rows.push({ label: `${ROUND_LABELS[round]} multiplier`, value: `×${multiplier}` });
  }
  rows.push({ label: "Total", value: formatPoints(player.points ?? 0), strong: true });

  return (
    <SettingsSheet title={`${player.name} · ${ROUND_LABELS[round]}`} onClose={onClose}>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          columnGap: 2,
          rowGap: 1,
        }}
      >
        {rows.map((row, index) => (
          <Fragment key={row.label}>
            {row.strong && index > 0 && (
              <Box
                aria-hidden
                sx={{ gridColumn: "1 / -1", borderTop: 1, borderColor: "divider" }}
              />
            )}
            <Box
              component="dt"
              sx={{
                color: row.strong ? "text.primary" : "text.secondary",
                fontWeight: row.strong ? 700 : 400,
              }}
            >
              {row.label}
            </Box>
            <Box
              component="dd"
              sx={{ m: 0, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
            >
              {row.value}
            </Box>
          </Fragment>
        ))}
      </Box>
    </SettingsSheet>
  );
};

export default PointsBreakdownSheet;
