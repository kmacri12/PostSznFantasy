import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { tint, tokens } from "../../theme";
import { PLAYER_STATUSES, type PlayerStatus } from "./lineupView";
import { STATUS_COLOR } from "./statusStyle";

/** Space between the picture's edge and the dots. */
const GAP = 2;

export const dotSize = (size: number): number => (size >= 40 ? 5 : 4);

/** How far the ring reaches past the picture's edge. */
export const ringReach = (size: number): number => GAP + dotSize(size);

interface Props {
  /** The team's roster by status; the picture is shown as it is without it. */
  counts: Record<PlayerStatus, number> | null | undefined;
  /** The picture's diameter. */
  size: number;
  children: ReactNode;
  /** Spoken name for the ring; leave out where the page already says the same in words. */
  label?: string;
}

/**
 * The team picture with one dot per rostered player around it, in a circle: green advanced, blue
 * live, grey to play, red eliminated, clockwise from the top. A team with nobody left also gets a
 * light red wash over its picture. (The Super Bowl never eliminates anyone, so a team with a
 * player in it never gets the wash; see `playerStatus`.) The dots take no height: they overlap
 * the space above and below the picture.
 */
const StatusRing = ({ counts, size, children, label }: Props) => {
  const total = counts ? PLAYER_STATUSES.reduce((sum, status) => sum + counts[status], 0) : 0;
  if (!counts || total === 0) return <>{children}</>;
  const reach = ringReach(size);
  const box = size + 2 * reach;
  const center = box / 2;
  const radius = size / 2 + GAP + dotSize(size) / 2;
  // Dots never touch: shrink them when a big roster crowds the circle.
  const dot = Math.min(dotSize(size), ((2 * Math.PI * radius) / total) * 0.65);
  const dots: { key: string; status: PlayerStatus }[] = [];
  for (const status of PLAYER_STATUSES) {
    for (let n = 0; n < counts[status]; n += 1) dots.push({ key: `${status}-${n}`, status });
  }
  const out = counts.eliminated === total;
  return (
    <Box
      sx={{
        position: "relative",
        flex: "none",
        width: box,
        height: size,
        // Layout width includes the dots; the height does not, so a row stays as tall as before.
        my: `${-reach}px`,
        py: `${reach}px`,
        boxSizing: "content-box",
        display: "grid",
        placeItems: "center",
      }}
    >
      <Box sx={{ position: "relative", width: size, height: size, borderRadius: "50%" }}>
        {children}
        {out && (
          <Box
            aria-hidden
            data-testid="out-wash"
            sx={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              bgcolor: tint(tokens.red, 38),
              pointerEvents: "none",
            }}
          />
        )}
      </Box>
      <svg
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {dots.map((entry, index) => {
          const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
          return (
            <circle
              key={entry.key}
              cx={center + radius * Math.cos(angle)}
              cy={center + radius * Math.sin(angle)}
              r={dot / 2}
              fill={STATUS_COLOR[entry.status]}
            />
          );
        })}
      </svg>
    </Box>
  );
};

export default StatusRing;
