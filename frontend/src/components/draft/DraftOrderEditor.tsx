import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { Alert, Box, Button, IconButton, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useDraftOrder, useLeagueTeams } from "../../api/queries";
import type { DraftState } from "../../api/types";
import { radii, tokens } from "../../theme";
import { mutationError } from "../common/friendlyError";
import { moveTeam, sameOrder } from "./orderMoves";

/** The pick order, one team per row with up and down buttons; saving posts the change to the Feed. */
const DraftOrderEditor = ({ draft, onDone }: { draft: DraftState; onDone: () => void }) => {
  const saveOrder = useDraftOrder(draft.seasonId);
  const teams = useLeagueTeams(draft.seasonId).data;
  const saved = useMemo(() => {
    const placed = [...draft.order].sort((a, b) => a.slot - b.slot).map((slot) => slot.teamId);
    const rest = (teams ?? []).map((team) => team.id).filter((id) => !placed.includes(id));
    return [...placed, ...rest];
  }, [draft.order, teams]);
  const [ids, setIds] = useState(saved);
  useEffect(() => setIds(saved), [saved]);

  const nameOf = (id: number) =>
    draft.order.find((slot) => slot.teamId === id)?.teamName ??
    teams?.find((team) => team.id === id)?.name ??
    `Team ${id}`;
  const changed = !sameOrder(ids, saved);
  const error = mutationError(saveOrder.error, "Couldn't save the draft order. Try again.");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: tokens.muted }}
      >
        <span>Draft order</span>
        <span>Not started</span>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      <Box
        component="ol"
        aria-label="Draft order"
        sx={{
          m: 0,
          p: 0,
          listStyle: "none",
          bgcolor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: `${radii.card}px`,
          overflow: "hidden",
        }}
      >
        {ids.map((id, index) => (
          <Box
            component="li"
            key={id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              pl: 1.75,
              pr: 1,
              minHeight: 52,
              fontSize: 15,
              borderTop: `1px solid ${tokens.border}`,
              "&:first-of-type": { borderTop: 0 },
            }}
          >
            <Typography sx={{ width: 20, color: tokens.muted, fontSize: 13 }}>
              {index + 1}
            </Typography>
            <Box component="b" sx={{ flex: 1, fontWeight: 600, overflowWrap: "anywhere" }}>
              {nameOf(id)}
            </Box>
            <IconButton
              aria-label={`Move ${nameOf(id)} up`}
              disabled={index === 0}
              onClick={() => setIds(moveTeam(ids, index, -1))}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={`Move ${nameOf(id)} down`}
              disabled={index === ids.length - 1}
              onClick={() => setIds(moveTeam(ids, index, 1))}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          disabled={!changed || saveOrder.isPending}
          onClick={() => saveOrder.mutate(ids, { onSuccess: onDone })}
          sx={{ flex: 1 }}
        >
          Save order
        </Button>
        <Button variant="outlined" onClick={onDone} sx={{ flex: 1 }}>
          {changed ? "Cancel" : "Done"}
        </Button>
      </Box>
    </Box>
  );
};

export default DraftOrderEditor;
