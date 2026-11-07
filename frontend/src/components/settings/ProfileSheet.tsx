import type { User as SupabaseUser } from "@supabase/auth-js";
import { useState } from "react";
import { useUser } from "../../contexts/UserContext";
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
  const { updateDisplayName } = useUser();
  const [name, setName] = useState(nameOf(user));
  const [editing, setEditing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (editing) {
    return (
      <EditTextSheet
        title="Display name"
        label="Display name"
        initial={name}
        maxLength={20}
        failure={failure}
        onClose={() => {
          setEditing(false);
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
        <SettingsRow label="Display name" value={name} onClick={() => setEditing(true)} />
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
      </SettingsCard>
    </SettingsSheet>
  );
};

export default ProfileSheet;
