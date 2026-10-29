import { Box, Chip, Paper, Typography } from "@mui/material";
import type React from "react";
import type { DraftPick, Team } from "../../pages/DraftPage";
import { tokens } from "../../theme";

interface Props {
  teams: Team[];
  draftPicks: DraftPick[][];
  currentPickIndex: number;
  myTeamIds?: number[];
}

const DraftBoard: React.FC<Props> = ({
  teams,
  draftPicks: draftBoard,
  currentPickIndex,
  myTeamIds = [],
}) => {
  const columns = `56px repeat(${teams.length || 1}, minmax(120px, 1fr))`;

  return (
    <Paper sx={{ p: 1.5, overflowX: "auto" }}>
      <Box
        sx={{ display: "grid", gridTemplateColumns: columns, gap: 0.75, minWidth: "max-content" }}
      >
        <Box />
        {teams.map((team) => (
          <Box key={team.id} sx={{ px: 1, py: 0.5 }}>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ color: myTeamIds.includes(team.id) ? tokens.gold : "inherit" }}
            >
              {team.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {team.ownerName ?? "Unclaimed"}
            </Typography>
          </Box>
        ))}

        {draftBoard.map((round, roundIndex) => (
          <Box key={round[0]?.numberPickOverall ?? roundIndex} sx={{ display: "contents" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                R{roundIndex + 1}
              </Typography>
            </Box>
            {round.map((pick) => {
              const isCurrent = pick.numberPickOverall === currentPickIndex;
              const isOnDeck = pick.numberPickOverall === currentPickIndex + 1;
              return (
                <Box
                  key={pick.numberPickOverall}
                  sx={{
                    minHeight: 56,
                    p: 1,
                    borderRadius: 1.5,
                    border: `1px solid ${isCurrent ? tokens.gold : tokens.border}`,
                    bgcolor: pick.playerName ? "rgba(34,211,238,.08)" : "rgba(15,23,42,.6)",
                    animation: isCurrent ? "pulse-glow 1.6s infinite" : "none",
                    position: "relative",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    #{pick.numberPickOverall}
                  </Typography>
                  {isOnDeck && (
                    <Chip
                      size="small"
                      label="On deck"
                      sx={{ position: "absolute", top: 4, right: 4, height: 18, fontSize: 10 }}
                    />
                  )}
                  {pick.playerName && (
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {pick.playerName}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default DraftBoard;
