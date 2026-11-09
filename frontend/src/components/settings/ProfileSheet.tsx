import type { User as SupabaseUser } from "@supabase/auth-js";
import { useState } from "react";
import { useSetAvatar } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import AvatarSheet from "../avatar/AvatarSheet";
import { mutationError } from "../common/friendlyError";
import PictureAvatar from "../common/PictureAvatar";
import DeleteAccountDialog from "./DeleteAccountDialog";
import EditTextSheet from "./EditTextSheet";
import NotificationsToggle from "./NotificationsToggle";
import SettingsCard from "./SettingsCard";
import SettingsRow from "./SettingsRow";
import SettingsSheet from "./SettingsSheet";
import ThemeModeRow from "./ThemeModeRow";

interface Props {
  user: SupabaseUser;
  onSignOut: () => void;
  onClose: () => void;
}

const nameOf = (user: SupabaseUser): string =>
  (user.user_metadata?.full_name as string | undefined) ||
  (user.user_metadata?.name as string | undefined) ||
  user.email?.split("@")[0] ||
  "";

/** Profile settings, opened from the avatar: display name, theme, notifications, sign out. */
const ProfileSheet = ({ user, onSignOut, onClose }: Props) => {
  const { updateDisplayName, avatarUrl, setAvatarUrl } = useUser();
  const picture = useSetAvatar({ kind: "me" });
  const [name, setName] = useState(nameOf(user));
  const [editing, setEditing] = useState<"name" | "picture" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (editing === "picture") {
    return (
      <AvatarSheet
        title="Profile picture"
        name={name}
        currentUrl={avatarUrl}
        failure={mutationError(picture.error, "Couldn't save the picture. Try again.")}
        onClose={() => {
          picture.reset();
          setEditing(null);
        }}
        onSave={async (blob) => setAvatarUrl(await picture.mutateAsync(blob))}
        onRemove={async () => {
          await picture.mutateAsync(null);
          setAvatarUrl(null);
        }}
      />
    );
  }

  if (editing === "name") {
    return (
      <EditTextSheet
        title="Display name"
        label="Display name"
        initial={name}
        maxLength={20}
        failure={failure}
        onClose={() => {
          setEditing(null);
          setFailure(null);
        }}
        onSave={async (value) => {
          const problem = await updateDisplayName(value);
          setFailure(problem);
          if (problem) throw new Error(problem);
          setName(value);
        }}
      />
    );
  }

  return (
    <SettingsSheet title="Profile settings" onClose={onClose}>
      <SettingsCard>
        <SettingsRow
          label="Profile picture"
          value={<PictureAvatar url={avatarUrl} name={name} size={32} />}
          onClick={() => setEditing("picture")}
        />
        <SettingsRow label="Display name" value={name} onClick={() => setEditing("name")} />
        {user.email && <SettingsRow label="Email" value={user.email} />}
        <ThemeModeRow />
        <NotificationsToggle />
        <SettingsRow
          label="Sign out"
          centered
          onClick={() => {
            onClose();
            onSignOut();
          }}
        />
        <SettingsRow label="Delete my account" centered danger onClick={() => setDeleting(true)} />
      </SettingsCard>
      {deleting && (
        <DeleteAccountDialog
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            onClose();
            onSignOut();
          }}
        />
      )}
    </SettingsSheet>
  );
};

export default ProfileSheet;
