import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Alert, Box, Button, Link, Typography } from "@mui/material";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useDraftControl } from "../../api/queries";
import type { DraftState } from "../../api/types";
import { useSeasonContext } from "../../contexts/SeasonContext";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { radii, tokens } from "../../theme";
import { mutationError } from "../common/friendlyError";
import { formatDraftTime } from "../league/countdown";
import ConfirmDraftAction from "./ConfirmDraftAction";
import { DraftDateDialog } from "./DraftSetupDialogs";
import LotteryReveal from "./LotteryReveal";
import PreDraftNotice from "./PreDraftNotice";
import { preflight } from "./preflight";

type Confirming = "start" | "undo" | "force-pick";

interface Props {
  draft: DraftState;
  /** User ids currently connected to the draft room. */
  presence: number[];
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

/** The pick the last Undo would remove, named so the commissioner knows what goes. */
const lastPickLine = (draft: DraftState): string | null => {
  const last = draft.picks[draft.picks.length - 1];
  if (!last) return null;
  const team = draft.order.find((slot) => slot.teamId === last.teamId)?.teamName ?? "a team";
  return `Pick ${last.numberPickOverall}: ${team} took ${last.playerName ?? "a player"}`;
};

/**
 * The commissioner's draft actions. Open from the lobby on, when they are needed; the
 * irreversible or costly ones (start, undo, auto-pick now) ask first.
 */
const CommissionerStrip = ({ draft, presence, editingOrder, onEditOrder }: Props) => {
  const control = useDraftControl(draft.seasonId);
  const { paths } = useSeasonContext();
  const status = draft.status;
  const preDraft = ["unscheduled", "scheduled", "lobby"].includes(status);
  const [open, setOpen] = useState(status === "lobby" || !preDraft);
  const [dateOpen, setDateOpen] = useState(false);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [lottery, setLottery] = useState<DraftState["order"] | null>(null);
  const reducedMotion = useReducedMotion();
  const run = (action: Parameters<typeof control.mutate>[0]) => () => control.mutate(action);
  const randomize = () =>
    control.mutate("randomize", {
      // Motion-sensitive users and the e2e build get the Feed's list of the order instead.
      onSuccess: (data) => !reducedMotion && data.order.length > 1 && setLottery(data.order),
    });
  const confirmed = (action: Confirming) =>
    control.mutate(action, { onSuccess: () => setConfirming(null) });
  const error = mutationError(control.error, "Couldn't update the draft. Try again.");
  const check = preflight(draft, presence);
  const onClock = draft.order.find((slot) => slot.teamId === draft.onTheClockTeamId);

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
              <Action disabled={draft.orderLocked || control.isPending} onClick={randomize}>
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
              <Action disabled={control.isPending} onClick={() => setConfirming("start")}>
                Start draft
              </Action>
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
                  <Action disabled={control.isPending} onClick={() => setConfirming("force-pick")}>
                    Auto-pick now
                  </Action>
                </>
              )}
              {status === "paused" && (
                <Action disabled={control.isPending} onClick={run("resume")}>
                  Resume
                </Action>
              )}
              <Action
                disabled={control.isPending || draft.picks.length === 0}
                onClick={() => setConfirming("undo")}
              >
                Undo last pick
              </Action>
            </>
          )}
        </Box>
      )}
      {lottery && <LotteryReveal order={lottery} onClose={() => setLottery(null)} />}
      {confirming === "start" && (
        <ConfirmDraftAction
          title="Start the draft?"
          confirmLabel="Start draft"
          lines={check.lines}
          warnings={check.warnings}
          disabled={!check.orderComplete}
          pending={control.isPending}
          error={error}
          onConfirm={() => confirmed("start")}
          onClose={() => setConfirming(null)}
        >
          <Typography variant="body2" color="text.secondary">
            This can't be undone. The order, draft type and timeout lock once it starts.
          </Typography>
          {check.warnings.length > 0 && (
            <Link component={RouterLink} to={paths.more} sx={{ display: "inline-block", mt: 1.5 }}>
              Invite members or assign owners first
            </Link>
          )}
        </ConfirmDraftAction>
      )}
      {confirming === "undo" && (
        <ConfirmDraftAction
          title="Undo the last pick?"
          confirmLabel="Undo pick"
          lines={[
            `${lastPickLine(draft) ?? "The last pick"}. The player goes back to the pool and that team is on the clock again.`,
          ]}
          destructive
          pending={control.isPending}
          error={error}
          onConfirm={() => confirmed("undo")}
          onClose={() => setConfirming(null)}
        />
      )}
      {confirming === "force-pick" && (
        <ConfirmDraftAction
          title="Auto-pick now?"
          confirmLabel="Auto-pick"
          lines={[
            `${onClock?.teamName ?? "The team on the clock"} loses its turn: the best available player is picked for it, from its queue first if that is how the clock works in your league.`,
          ]}
          pending={control.isPending}
          error={error}
          onConfirm={() => confirmed("force-pick")}
          onClose={() => setConfirming(null)}
        />
      )}
      {dateOpen && <DraftDateDialog draft={draft} open onClose={() => setDateOpen(false)} />}
    </Box>
  );
};

export default CommissionerStrip;
