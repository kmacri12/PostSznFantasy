import { useState } from "react";
import { useRenameTeam } from "../../api/queries";
import type { TeamDetails } from "../../api/types";
import { mutationError } from "../common/friendlyError";
import EditTextSheet from "./EditTextSheet";
import SettingsCard from "./SettingsCard";
import SettingsRow from "./SettingsRow";
import SettingsSheet from "./SettingsSheet";

interface Props {
  team: TeamDetails;
  /** "You" for your own team, otherwise the owner's name. */
  owner: string;
  /** The owner or a commissioner, in a season that is not archived. */
  canRename: boolean;
  onClose: () => void;
}

/** Team settings, opened from the cog on the Team page. Anyone can look; the owner renames. */
const TeamSettingsSheet = ({ team, owner, canRename, onClose }: Props) => {
  const rename = useRenameTeam(team.id);
  const [renaming, setRenaming] = useState(false);

  if (renaming) {
    return (
      <EditTextSheet
        title="Team name"
        label="Team name"
        initial={team.name}
        maxLength={40}
        failure={mutationError(rename.error, "Couldn't rename the team. Try again.")}
        onClose={() => {
          rename.reset();
          setRenaming(false);
        }}
        onSave={async (value) => {
          await rename.mutateAsync(value);
        }}
      />
    );
  }

  return (
    <SettingsSheet title="Team settings" onClose={onClose}>
      <SettingsCard>
        <SettingsRow
          label="Team name"
          value={team.name}
          onClick={canRename ? () => setRenaming(true) : undefined}
        />
        <SettingsRow label="Owner" value={owner} />
      </SettingsCard>
    </SettingsSheet>
  );
};

export default TeamSettingsSheet;
