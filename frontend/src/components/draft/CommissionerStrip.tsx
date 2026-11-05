import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Alert, Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import { useDraftControl } from "../../api/queries";
import type { DraftState } from "../../api/types";
import { radii, tokens } from "../../theme";
import { mutationError } from "../common/friendlyError";
import { formatDraftTime } from "../league/countdown";
import { DraftDateDialog, DraftRulesDialog } from "./DraftSetupDialogs";
import PreDraftNotice from "./PreDraftNotice";

interface Props {
  draft: DraftState;
  editingOrder: boolean;
  onEditOrder: () => void;
}

const actionSx = {
  minHeight: 52,
  flexDirection: "column",
  bgcolor: tokens.surfaceRaised,
  color: tokens.text,
  border: `1px solid ${tokens.border}`,
  borderRadius: "10px",
  fontSize: 14,
  fontWeight: 600,
  "&:hover": { bgcolor: tokens.surfaceRaised, borderColor: tokens.borderStrong },
} as const;

const Action = ({
  children,
  hint,
  ...props
}: { children: string; hint?: string } & React.ComponentProps<typeof Button>) => (
  <Button fullWidth {...props} sx={actionSx}>
    {children}
    {hint && (
      <Typography component="small" sx={{ fontSize: 11, fontWeight: 400, color: tokens.muted }}>
        {hint}
      </Typography>
    )}
  </Button>
);

/** Collapsed row that opens the commissioner's draft actions; before the draft they set it up. */
const CommissionerStrip = ({ draft, editingOrder, onEditOrder }: Props) => {
  const control = useDraftControl(draft.seasonId);
  const [open, setOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const status = draft.status;
  const preDraft = ["unscheduled", "scheduled", "lobby"].includes(status);
  const run = (action: Parameters<typeof control.mutate>[0]) => () => control.mutate(action);
  const error = mutationError(control.error, "Couldn't update the draft. Try again.");

  return (
    <Box
      sx={{
        bgcolor: tokens.surface,
        borderBottom: `1px solid ${tokens.border}`,
        px: 2,
      }}
    >
      <Button
        fullWidth
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        sx={{
          justifyContent: "space-between",
          color: tokens.muted,
          fontSize: 12,
          fontWeight: 500,
          minHeight: 44,
          px: 0,
          borderRadius: 0,
        }}
        endIcon={
          open ? (
            <Box component="span" sx={{ fontSize: 12 }}>
              Hide
            </Box>
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )
        }
      >
        Commissioner controls
      </Button>
      {open && (
        <Box sx={{ pb: 1.5, display: "grid", gap: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {preDraft ? (
            <>
              <Action disabled={draft.orderLocked || control.isPending} onClick={run("randomize")}>
                Randomize draft order
              </Action>
              <Action disabled={draft.orderLocked} onClick={onEditOrder}>
                {editingOrder ? "Done editing order" : "Edit draft order"}
              </Action>
              <Action
                hint={draft.startTime ? formatDraftTime(draft.startTime) : "Not set"}
                onClick={() => setDateOpen(true)}
              >
                Change date
              </Action>
              <Action disabled={control.isPending} onClick={run("start")}>
                Start draft
              </Action>
              <Button
                onClick={() => setRulesOpen(true)}
                sx={{ color: tokens.textSoft, fontSize: 13, minHeight: 44 }}
              >
                Draft settings
              </Button>
              <Box
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderRadius: `${radii.mark + 2}px`,
                  bgcolor: tokens.accentSurface,
                  border: `1px solid ${tokens.accentBorder}`,
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: tokens.accentSoft,
                }}
              >
                Every order change is posted to the Feed, with the full new order when you
                randomize.
              </Box>
              <PreDraftNotice state={draft} />
            </>
          ) : (
            <>
              {status === "in_progress" && (
                <>
                  <Action disabled={control.isPending} onClick={run("pause")}>
                    Pause
                  </Action>
                  <Action disabled={control.isPending} onClick={run("force-pick")}>
                    Auto-pick now
                  </Action>
                </>
              )}
              {status === "paused" && (
                <Action disabled={control.isPending} onClick={run("resume")}>
                  Resume
                </Action>
              )}
              <Action disabled={control.isPending} onClick={run("undo")}>
                Undo last pick
              </Action>
            </>
          )}
        </Box>
      )}
      {dateOpen && <DraftDateDialog draft={draft} open onClose={() => setDateOpen(false)} />}
      {rulesOpen && <DraftRulesDialog draft={draft} open onClose={() => setRulesOpen(false)} />}
    </Box>
  );
};

export default CommissionerStrip;
