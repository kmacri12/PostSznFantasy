import { Box, Typography } from "@mui/material";
import type { BracketGame, BracketTeam } from "../../api/types";
import { tokens } from "../../theme";
import { positionColor } from "../draft/positions";
import SettingsSheet from "../settings/SettingsSheet";
import { gameStatusText, matchupTitle } from "./bracketView";

const Heading = ({ children }: { children: string }) => (
  <Typography component="h3" sx={{ fontSize: 13, fontWeight: 600, color: tokens.muted }}>
    {children}
  </Typography>
);

const PositionTag = ({ position }: { position: string }) => (
  <Box
    component="span"
    sx={{
      bgcolor: positionColor(position),
      borderRadius: 1,
      px: 0.75,
      minWidth: 28,
      textAlign: "center",
      fontSize: 12,
      fontWeight: 600,
      flex: "none",
    }}
  >
    {position}
  </Box>
);

const Line = ({
  position,
  name,
  trailing,
}: {
  position: string;
  name: string;
  trailing: string;
}) => (
  <Box
    component="li"
    sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 36, listStyle: "none" }}
  >
    <PositionTag position={position} />
    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 14 }}>
      {name}
    </Typography>
    <Typography sx={{ fontSize: 13, color: tokens.muted, flex: "none" }}>{trailing}</Typography>
  </Box>
);

const TeamTop = ({ team }: { team: BracketTeam | null }) => (
  <Box>
    <Heading>{team ? `${team.city} ${team.name}: top players` : "Team to be decided"}</Heading>
    {team && team.topPlayers.length > 0 ? (
      <Box component="ul" sx={{ m: 0, p: 0 }}>
        {team.topPlayers.map((p) => (
          <Line key={p.id} position={p.position} name={p.name} trailing={`${p.points} pts`} />
        ))}
      </Box>
    ) : (
      team && (
        <Typography sx={{ fontSize: 13, color: tokens.muted }}>
          No regular-season stats yet.
        </Typography>
      )
    )}
  </Box>
);

/** A game's players: each team's top scorers, then the caller's own players in it. */
const GameSheet = ({ game, onClose }: { game: BracketGame; onClose: () => void }) => (
  <SettingsSheet title={matchupTitle(game)} onClose={onClose} closeLabel="Close">
    <Typography sx={{ fontSize: 14, color: tokens.textSoft }}>
      {gameStatusText(game)}
      {game.homePoints !== null && game.awayPoints !== null
        ? ` · ${game.away?.abbreviation ?? "TBD"} ${game.awayPoints}, ${game.home?.abbreviation ?? "TBD"} ${game.homePoints}`
        : ""}
    </Typography>
    <Box>
      <Heading>Your players in this game</Heading>
      {game.myPlayers.length > 0 ? (
        <Box component="ul" sx={{ m: 0, p: 0 }}>
          {game.myPlayers.map((p) => (
            <Line
              key={p.id}
              position={p.position}
              name={p.name}
              trailing={p.role === "starter" ? "Starter" : "Bench"}
            />
          ))}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 13, color: tokens.muted }}>
          None yet. Players on your roster from these teams show up here once you have drafted.
        </Typography>
      )}
    </Box>
    <TeamTop team={game.away} />
    <TeamTop team={game.home} />
  </SettingsSheet>
);

export default GameSheet;
