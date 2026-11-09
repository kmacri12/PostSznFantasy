import { useState } from "react";
import { useRenameTeam, useSetAvatar } from "../../api/queries";
import type { TeamDetails } from "../../api/types";
import AvatarSheet from "../avatar/AvatarSheet";
import { mutationError } from "../common/friendlyError";
import PictureAvatar from "../common/PictureAvatar";
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

/** Team settings, opened from the cog on the Team page. Anyone can look; the owner changes the name and picture. */
const TeamSettingsSheet = ({ team, owner, canRename, onClose }: Props) => {
  const rename = useRenameTeam(team.id);
  const picture = useSetAvatar({ kind: "team", id: team.id });
  const [renaming, setRenaming] = useState(false);
  const [pictureOpen, setPictureOpen] = useState(false);

  if (pictureOpen) {
    return (
      <AvatarSheet
        title="Team picture"
        name={team.name}
        currentUrl={team.avatarUrl}
        failure={mutationError(picture.error, "Couldn't save the picture. Try again.")}
        onClose={() => {
          picture.reset();
          setPictureOpen(false);
        }}
        onSave={async (blob) => {
          await picture.mutateAsync(blob);
        }}
        onRemove={async () => {
          await picture.mutateAsync(null);
        }}
      />
    );
  }

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
          label="Team picture"
          value={<PictureAvatar url={team.avatarUrl} name={team.name} size={32} />}
          onClick={canRename ? () => setPictureOpen(true) : undefined}
        />
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
