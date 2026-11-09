import { useState } from "react";
import type { DraftState, DraftType, PickTimeoutAction } from "../../api/types";
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
      {editing === "date" && (
        <DraftDateDialog draft={draft} open onClose={() => setEditing(null)} />
      )}
      {editing === "rules" && (
        <DraftRulesDialog draft={draft} open onClose={() => setEditing(null)} />
      )}
    </SettingsSheet>
  );
};

export default DraftSettingsSheet;
