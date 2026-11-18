import { Box, Button } from "@mui/material";
import { useState } from "react";
import { useSetAutopilot } from "../../api/queries";
import type { DraftState, DraftType, PickTimeoutAction } from "../../api/types";
import { AUTOPILOT } from "../../content/rules";
import { visuallyHidden } from "../common/visuallyHidden";
import { formatDraftTime } from "../league/countdown";
import SettingsCard from "../settings/SettingsCard";
import SettingsRow from "../settings/SettingsRow";
import SettingsSheet from "../settings/SettingsSheet";
import { DraftDateDialog, DraftRulesDialog } from "./DraftSetupDialogs";

const DRAFT_TYPE_LABEL: Record<DraftType, string> = {
  snake: "Snake",
  linear: "Linear",
  third_round_reversal: "Third-round reversal",
};

const TIMEOUT_LABEL: Record<PickTimeoutAction, string> = {
  queue_then_best_available: "Queue, then best",
  best_available: "Best available",
};

interface Props {
  draft: DraftState;
  /** A commissioner in a season that is not archived: the rows open their editors. */
  canEdit: boolean;
  onClose: () => void;
}

/** Draft settings, opened from the cog in the draft room. Everyone sees them; commissioners edit. */
const DraftSettingsSheet = ({ draft, canEdit, onClose }: Props) => {
  const [editing, setEditing] = useState<"date" | "rules" | null>(null);
  const preDraft = ["unscheduled", "scheduled", "lobby"].includes(draft.status);
  const editable = canEdit && draft.status !== "completed";
  const openRules = editable ? () => setEditing("rules") : undefined;

  return (
    <SettingsSheet title="Draft settings" onClose={onClose}>
      <SettingsCard>
        <SettingsRow
          label="Draft date"
          value={draft.startTime ? formatDraftTime(draft.startTime) : "Not set"}
          onClick={editable && preDraft ? () => setEditing("date") : undefined}
        />
        <SettingsRow
          label="Seconds per pick"
          value={String(draft.timePerPickSeconds)}
          onClick={openRules}
        />
        <SettingsRow
          label="Draft type"
          value={DRAFT_TYPE_LABEL[draft.draftType]}
          onClick={openRules}
        />
        <SettingsRow
          label="When the clock runs out"
          value={TIMEOUT_LABEL[draft.pickTimeoutAction]}
          onClick={openRules}
        />
      </SettingsCard>
      {draft.autopilotTeamIds.length > 0 && draft.status !== "completed" && (
        <AutopilotTeams draft={draft} canTurnOff={canEdit} />
      )}
      {editing === "date" && (
        <DraftDateDialog draft={draft} open onClose={() => setEditing(null)} />
      )}
      {editing === "rules" && (
        <DraftRulesDialog draft={draft} open onClose={() => setEditing(null)} />
      )}
    </SettingsSheet>
  );
};

/** Who the clock is picking for early; a commissioner can switch a team back to its timer. */
const AutopilotTeams = ({ draft, canTurnOff }: { draft: DraftState; canTurnOff: boolean }) => {
  const setAutopilot = useSetAutopilot(draft.seasonId);
  return (
    <SettingsCard title={AUTOPILOT.settingsTitle}>
      {draft.autopilotTeamIds.map((teamId) => {
        const name = draft.order.find((slot) => slot.teamId === teamId)?.teamName ?? "A team";
        return (
          <SettingsRow
            key={teamId}
            label={name}
            trailing={
              canTurnOff ? (
                <Button
                  size="small"
                  sx={{ minHeight: 44 }}
                  disabled={setAutopilot.isPending}
                  onClick={() => setAutopilot.mutate({ teamId, enabled: false })}
                >
                  {AUTOPILOT.turnOff}{" "}
                  <Box component="span" sx={visuallyHidden}>{`autopilot for ${name}`}</Box>
                </Button>
              ) : undefined
            }
          />
        );
      })}
    </SettingsCard>
  );
};

export default DraftSettingsSheet;
