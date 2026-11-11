import { Divider, Typography } from "@mui/material";
import type { User as SupabaseUser } from "@supabase/auth-js";
import { useState } from "react";
import { useSetAvatar } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import { nameProblem } from "../../utils/displayName";
import AvatarSheet from "../avatar/AvatarSheet";
import { mutationError } from "../common/friendlyError";
import PictureAvatar from "../common/PictureAvatar";
import AccountSheet from "./AccountSheet";
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

/** Profile settings, opened from the avatar: display name, theme, notifications, sign out. */
const ProfileSheet = ({ user, onSignOut, onClose }: Props) => {
  const { updateDisplayName, avatarUrl, setAvatarUrl, username } = useUser();
  const picture = useSetAvatar({ kind: "me" });
  const [name, setName] = useState(username ?? "");
  const [editing, setEditing] = useState<"name" | "picture" | "account" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (editing === "account") return <AccountSheet onClose={() => setEditing(null)} />;

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
        validate={(value) => nameProblem(value)}
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
        <SettingsRow
          label="Account"
          value={user.email ?? "Email, devices, your data"}
          onClick={() => setEditing("account")}
        />
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
      </SettingsCard>
      {/* Far from Sign out and the everyday rows, so it is never a stray tap away (#375). */}
      <Divider sx={{ mt: 4 }} />
      <Typography
        component="h3"
        variant="overline"
        sx={{ color: "error.light", fontWeight: 700, mt: 2, mb: 1, display: "block" }}
      >
        Danger zone
      </Typography>
      <SettingsCard>
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
