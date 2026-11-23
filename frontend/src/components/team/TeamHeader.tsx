import { Box, Typography } from "@mui/material";
import { useLayoutEffect, useRef, useState } from "react";
import { tokens } from "../../theme";
import PictureAvatar from "../common/PictureAvatar";
import { formatPoints } from "../league/standingsView";
import CogButton from "../settings/CogButton";
import type { RosterStatus } from "./lineupView";
import PlayersLeft, { gridWidth } from "./PlayersLeft";

const AVATAR = 44;
const GAP = 12;
/** The cog's box (40px tap target) and the 4px between it and the name. */
const COG = 44;

interface Props {
  name: string;
  avatarUrl: string | null | undefined;
  /** "You", or the owner's name, with the rank when there is one. */
  ownerLine: string;
  total: number | undefined;
  status: RosterStatus | null;
  onOpenSettings: () => void;
}

const nameSx = { fontSize: { xs: 20, md: 26 }, fontWeight: 700 } as const;

/**
 * The Team page header: picture, name and settings cog, the total. Players left sits in the gap
 * between the cog and the total when the name leaves room for it; a long name keeps its line and
 * the same information goes on a line of its own below (decided by measuring, so a name is never
 * squeezed or wrapped to make space for it).
 */
const TeamHeader = ({ name, avatarUrl, ownerLine, total, status, onOpenSettings }: Props) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const [beside, setBeside] = useState(true);
  const players = status?.statuses.length ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: name and total change the widths measured
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || players === 0) return;
    const measure = () => {
      const needed =
        AVATAR +
        GAP +
        (nameRef.current?.offsetWidth ?? 0) +
        COG +
        GAP +
        gridWidth(players) +
        GAP +
        (totalRef.current?.offsetWidth ?? 0);
      setBeside(needed <= row.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [name, total, players]);

  return (
    <>
      <Box
        ref={rowRef}
        sx={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: `${GAP}px`,
        }}
      >
        <PictureAvatar url={avatarUrl} name={name} size={AVATAR} />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="h1" sx={{ ...nameSx, overflowWrap: "anywhere" }}>
              {name}
            </Typography>
            {/* Negative margins only: the cog keeps its full tap target but stops adding height. */}
            <Box sx={{ my: -0.75 }}>
              <CogButton label="Team settings" onClick={onOpenSettings} />
            </Box>
          </Box>
          <Typography component="span" sx={{ fontSize: { xs: 12, md: 13 }, color: tokens.muted }}>
            {ownerLine}
          </Typography>
        </Box>
        {status && beside && <PlayersLeft status={status} layout="grid" />}
        {total !== undefined && (
          <Box ref={totalRef} sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 700, lineHeight: 1.2 }}>
              {formatPoints(total)}
            </Typography>
            <Typography component="span" sx={{ fontSize: { xs: 12, md: 13 }, color: tokens.muted }}>
              total
            </Typography>
          </Box>
        )}
        {/* Measures how wide the name is on one line, whatever room it is given. */}
        <Typography
          ref={nameRef}
          aria-hidden
          component="span"
          sx={{
            ...nameSx,
            position: "absolute",
            visibility: "hidden",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {name}
        </Typography>
      </Box>
      {status && !beside && <PlayersLeft status={status} layout="row" />}
    </>
  );
};

export default TeamHeader;
