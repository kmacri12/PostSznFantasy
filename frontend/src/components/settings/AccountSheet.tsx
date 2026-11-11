import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { downloadMyData, useAccount, useRemoveDevice } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import { browserTimeZone, formatPlainInViewerZone } from "../../utils/timeZone";
import Dialog from "../common/AppDialog";
import { friendlyError, mutationError } from "../common/friendlyError";
import EditTextSheet from "./EditTextSheet";
import SettingsCard from "./SettingsCard";
import SettingsRow from "./SettingsRow";
import SettingsSheet from "./SettingsSheet";
import TimeFormatSheet from "./TimeFormatSheet";

const METHOD_NAMES: Record<string, string> = { google: "Google", email: "Emailed code" };
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const methodsText = (methods: string[]): string =>
  methods.length ? methods.map((m) => METHOD_NAMES[m] ?? m).join(", ") : "Not available";

const sectionTitle = (text: string) => (
  <Typography
    component="h3"
    variant="overline"
    sx={{ color: "text.secondary", fontWeight: 700, mt: 1, display: "block" }}
  >
    {text}
  </Typography>
);

interface Props {
  onClose: () => void;
}

/** The account center (#405), opened from Profile settings: email, sign-in, time, devices, data. */
const AccountSheet = ({ onClose }: Props) => {
  const { changeEmail, signOutEverywhere } = useUser();
  const account = useAccount();
  const removeDevice = useRemoveDevice();
  const [view, setView] = useState<"email" | "time" | null>(null);
  const [emailFailure, setEmailFailure] = useState<string | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signOutFailure, setSignOutFailure] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailure, setDownloadFailure] = useState<string | null>(null);

  const data = account.data;

  if (view === "email") {
    return (
      <EditTextSheet
        title="Change email"
        label="New email"
        initial=""
        maxLength={120}
        helperText="We email a confirmation link. Your address changes once you follow it."
        validate={(value) =>
          value && !EMAIL_SHAPE.test(value) ? "Enter a full email address." : null
        }
        failure={emailFailure}
        onClose={() => {
          setView(null);
          setEmailFailure(null);
        }}
        onSave={async (value) => {
          const problem = await changeEmail(value);
          setEmailFailure(problem);
          if (problem) throw new Error(problem);
          setEmailSentTo(value);
        }}
      />
    );
  }

  if (view === "time" && data) {
    return <TimeFormatSheet account={data} onClose={() => setView(null)} />;
  }

  const timeSummary = data
    ? `${data.displayTimeZone ?? `This device (${browserTimeZone()})`}, ${
        data.hourCycle ? `${data.hourCycle}-hour` : "device clock"
      }`
    : "";

  const download = async () => {
    setDownloading(true);
    setDownloadFailure(null);
    try {
      await downloadMyData();
    } catch (error) {
      setDownloadFailure(friendlyError(error, "Couldn't prepare your data. Try again."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SettingsSheet title="Account" onClose={onClose}>
      {account.isError && <Alert severity="error">Couldn't load your account. Try again.</Alert>}
      {emailSentTo && (
        <Alert severity="info">
          We sent a confirmation link to {emailSentTo}. Your email changes after you follow it.
        </Alert>
      )}
      {sectionTitle("Sign-in")}
      <SettingsCard>
        <SettingsRow label="Email" value={data?.email ?? "None"} onClick={() => setView("email")} />
        <SettingsRow label="Sign-in methods" value={data ? methodsText(data.signInMethods) : ""} />
      </SettingsCard>
      {sectionTitle("Time")}
      <SettingsCard>
        <SettingsRow
          label="Time zone and clock"
          value={timeSummary}
          onClick={data ? () => setView("time") : undefined}
        />
      </SettingsCard>
      {sectionTitle("Devices with notifications")}
      <SettingsCard>
        {data && data.devices.length === 0 && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography color="text.secondary" variant="body2">
              No devices. Turn on Notifications in Profile settings to add this one.
            </Typography>
          </Box>
        )}
        {data?.devices.map((device) => (
          <Box
            key={device.id}
            sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.5, minHeight: 52 }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>
                {device.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last active {formatPlainInViewerZone(device.lastSeen, { dateStyle: "medium" })}
              </Typography>
            </Box>
            <Button
              color="error"
              sx={{ minHeight: 44, minWidth: 44 }}
              disabled={removeDevice.isPending}
              aria-label={`Remove ${device.label}`}
              onClick={() => removeDevice.mutate(device.id)}
            >
              Remove
            </Button>
          </Box>
        ))}
      </SettingsCard>
      {removeDevice.error && (
        <Alert severity="error">
          {mutationError(removeDevice.error, "Couldn't remove the device. Try again.")}
        </Alert>
      )}
      {sectionTitle("Your data")}
      <SettingsCard>
        <SettingsRow
          label={downloading ? "Preparing your data" : "Download my data"}
          value="JSON"
          onClick={downloading ? undefined : () => void download()}
        />
      </SettingsCard>
      {downloadFailure && <Alert severity="error">{downloadFailure}</Alert>}
      {sectionTitle("Security")}
      <SettingsCard>
        <SettingsRow
          label="Sign out everywhere"
          centered
          danger
          onClick={() => setConfirmingSignOut(true)}
        />
      </SettingsCard>
      <Dialog
        open={confirmingSignOut}
        onClose={() => setConfirmingSignOut(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Sign out everywhere?</DialogTitle>
        <DialogContent>
          <Typography>
            Every device signed in to your account is signed out, including this one, and
            notifications stop on all of them. You can sign in again any time.
          </Typography>
          {signOutFailure && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {signOutFailure}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button sx={{ minHeight: 44 }} onClick={() => setConfirmingSignOut(false)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            sx={{ minHeight: 44 }}
            onClick={async () => {
              const problem = await signOutEverywhere();
              setSignOutFailure(problem);
              if (!problem) onClose();
            }}
          >
            Sign out everywhere
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsSheet>
  );
};

export default AccountSheet;
