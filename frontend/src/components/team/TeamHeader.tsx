import { Box, Typography } from "@mui/material";
import type { TeamPicture } from "../../api/types";
import { tokens } from "../../theme";
import PictureAvatar from "../common/PictureAvatar";
import { formatPoints } from "../league/standingsView";
import CogButton from "../settings/CogButton";
import type { RosterStatus } from "./lineupView";
import PlayersLeft from "./PlayersLeft";
import StatusBreakdownTrigger from "./StatusBreakdown";
import StatusRing from "./StatusRing";

const AVATAR = 44;

interface Props {
  name: string;
  avatarUrl: string | null | undefined;
  picture?: TeamPicture | null;
  /** "You", or the owner's name, with the rank when there is one. */
  ownerLine: string;
  total: number | undefined;
  status: RosterStatus | null;
  onOpenSettings: () => void;
}

/**
 * The Team page header: the picture ringed by one dot per player (red wash when nobody is left),
 * the name with the settings cog, the owner line ending in "10 players left", and the total. A tap on the picture or on the
 * "10 players left" text opens the breakdown by status.
 */
const TeamHeader = ({
  name,
  avatarUrl,
  picture,
  ownerLine,
  total,
  status,
  onOpenSettings,
}: Props) => (
  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
    <StatusBreakdownTrigger counts={status?.counts}>
      <StatusRing counts={status?.counts} size={AVATAR}>
        <PictureAvatar url={avatarUrl} generated={picture} name={name} size={AVATAR} />
      </StatusRing>
    </StatusBreakdownTrigger>
    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 700, overflowWrap: "anywhere" }}
        >
          {name}
        </Typography>
        {/* Negative margins only: the cog keeps its full tap target but stops adding height. */}
        <Box sx={{ my: -0.75 }}>
          <CogButton label="Team settings" onClick={onOpenSettings} />
        </Box>
      </Box>
      <Typography
        component="span"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: 0.75,
          fontSize: { xs: 12, md: 13 },
          color: tokens.muted,
        }}
      >
        {ownerLine}
        {status && (
          <>
            <span aria-hidden>·</span>
            <PlayersLeft status={status} />
          </>
        )}
      </Typography>
    </Box>
    {total !== undefined && (
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 700, lineHeight: 1.2 }}>
          {formatPoints(total)}
        </Typography>
        <Typography component="span" sx={{ fontSize: { xs: 12, md: 13 }, color: tokens.muted }}>
          total
        </Typography>
      </Box>
    )}
  </Box>
);

export default TeamHeader;
