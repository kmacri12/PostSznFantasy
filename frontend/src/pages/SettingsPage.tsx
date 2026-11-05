import { Alert, Button, Container, Paper, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  useDraft,
  useInvite,
  useLeagueInfo,
  useLeagueSettings,
  useRenameTeam,
  useUpdateLeague,
  useUpdateSeason,
  useUpdateSettings,
} from "../api/queries";
import ErrorState from "../components/common/ErrorState";
import { mutationError } from "../components/common/friendlyError";
import LoadingState from "../components/common/LoadingState";
import DraftSetupPanel from "../components/draft/DraftSetupPanel";
import ArchivedNotice from "../components/league/ArchivedNotice";
import DeleteLeagueDialog from "../components/settings/DeleteLeagueDialog";
import { valuesEqual } from "../components/settings/dirty";
import EditTextSheet from "../components/settings/EditTextSheet";
import InviteSheet from "../components/settings/InviteSheet";
import MembersSheet from "../components/settings/MembersSheet";
import NotificationsToggle from "../components/settings/NotificationsToggle";
import PostseasonForm from "../components/settings/PostseasonForm";
import RosterForm from "../components/settings/RosterForm";
import ScoringForm from "../components/settings/ScoringForm";
import SettingsCard from "../components/settings/SettingsCard";
import SettingsGroup from "../components/settings/SettingsGroup";
import SettingsRow from "../components/settings/SettingsRow";
import { NOTES_HINT, NOTES_MAX_LENGTH, SETTING_HELP } from "../content/rules";
import { useSeasonContext } from "../contexts/SeasonContext";
import { useUser } from "../contexts/UserContext";
import { fromApi, postseasonFromApi, ROSTER_KEYS, SCORING_KEYS } from "../settings/convert";
import { POSTSEASON_KEYS, type PostseasonValues } from "../settings/postseasonFields";
import type { SettingsValues } from "../settings/types";
import { TAB_BAR_HEIGHT } from "../theme";

type Sheet =
  | "displayName"
  | "teamName"
  | "leagueName"
  | "notes"
  | "teamCount"
  | "members"
  | "invite"
  | "delete"
  | null;

const teamCountProblem = (value: string) => {
  const count = Number(value);
  return Number.isInteger(count) && count >= 2 && count <= 14
    ? null
    : "Enter a number from 2 to 14.";
};

/** Your settings for everyone; Commissioner settings (rows that open sheets, rules as accordions) for commissioners. */
function SettingsPage() {
  const { leagueId, seasonId, season } = useSeasonContext();
  const { userId, user, signOutUser, updateDisplayName } = useUser();
  const info = useLeagueInfo(leagueId, !season.isFormerMember).data;
  const archived = season.finished;
  const settingsQuery = useLeagueSettings(seasonId);
  const draft = useDraft(seasonId);
  const updateSettings = useUpdateSettings(seasonId);
  const updateLeague = useUpdateLeague(leagueId);
  const updateSeason = useUpdateSeason(seasonId);
  const renameTeam = useRenameTeam(season.myTeamId ?? undefined);
  const isCommissioner = info?.myRole === "commissioner";
  const canEdit = season.canCommission;
  const invite = useInvite(leagueId, isCommissioner);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [roster, setRoster] = useState<SettingsValues>({});
  const [scoring, setScoring] = useState<SettingsValues>({});
  const [postseason, setPostseason] = useState<PostseasonValues>({});

  const baseline = useMemo(
    () =>
      settingsQuery.data
        ? {
            roster: fromApi(settingsQuery.data, ROSTER_KEYS),
            scoring: fromApi(settingsQuery.data, SCORING_KEYS),
            postseason: postseasonFromApi(settingsQuery.data, POSTSEASON_KEYS),
          }
        : null,
    [settingsQuery.data],
  );
  const dirty =
    baseline !== null &&
    !(
      valuesEqual(baseline.roster, roster) &&
      valuesEqual(baseline.scoring, scoring) &&
      valuesEqual(baseline.postseason, postseason)
    );

  useEffect(() => {
    if (!baseline) return;
    setRoster(baseline.roster);
    setScoring(baseline.scoring);
    setPostseason(baseline.postseason);
  }, [baseline]);

  const discard = () => {
    if (!baseline) return;
    setRoster(baseline.roster);
    setScoring(baseline.scoring);
    setPostseason(baseline.postseason);
  };

  const save = () =>
    updateSettings.mutateAsync({
      ...roster,
      ...Object.fromEntries(
        Object.entries(scoring).map(([key, value]) => [key, Number(value) || 0]),
      ),
      ...Object.fromEntries(
        Object.entries(postseason).map(([key, value]) => [
          key,
          key.startsWith("multiplier_") ? Number(value) || 0 : value,
        ]),
      ),
    });

  if (settingsQuery.isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <LoadingState what="settings" />
      </Container>
    );
  }
  if (settingsQuery.isError) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <ErrorState
          message="Couldn't load this league's settings. Check your connection and try again."
          onRetry={() => settingsQuery.refetch()}
        />
      </Container>
    );
  }

  const started = ["in_progress", "paused", "completed"].includes(draft.data?.status ?? "");
  const myMember = season.members.find((member) => member.userId === userId);
  const displayName = myMember?.username ?? user?.email?.split("@")[0] ?? "";
  const myTeam = season.teams.find((team) => team.id === season.myTeamId);
  const notes = info?.notes ?? "";
  const activeInvite = invite.data && !invite.data.revoked;
  const failure = mutationError(updateSettings.error, "Couldn't save the settings. Try again.");
  const close = () => {
    setSheet(null);
    setNameError(null);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      <SettingsCard title="Your settings">
        <SettingsRow
          label="Display name"
          value={displayName}
          onClick={() => setSheet("displayName")}
        />
        {myTeam && (
          <SettingsRow
            label="Team name"
            value={myTeam.name}
            onClick={archived ? undefined : () => setSheet("teamName")}
          />
        )}
        <NotificationsToggle />
        <SettingsRow label="Sign out" centered onClick={() => void signOutUser()} />
      </SettingsCard>

      {isCommissioner && info && (
        <>
          {archived && <ArchivedNotice what="the roster, scoring and team count" />}
          {started && !archived && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              The draft has started, so team count, roster slots and position caps are locked.
              Scoring and round multipliers can still change.
            </Alert>
          )}
          <SettingsCard title="Commissioner settings">
            <SettingsRow
              label="Edit league name"
              value={info.name}
              onClick={() => setSheet("leagueName")}
            />
            <SettingsRow
              label="Edit league note"
              value={notes || "No note yet"}
              onClick={() => setSheet("notes")}
            />
            <SettingsRow
              label="Number of teams"
              value={`${season.numberTeams} teams${started ? " · locked" : ""}`}
              onClick={canEdit && !started ? () => setSheet("teamCount") : undefined}
            />
            <SettingsRow
              label="Edit members"
              value={`${info.members.length} members`}
              onClick={() => setSheet("members")}
            />
            <SettingsGroup title="Roster">
              <RosterForm values={roster} onChange={setRoster} disabled={!canEdit || started} />
            </SettingsGroup>
            <SettingsGroup title="Scoring">
              <ScoringForm
                values={scoring}
                disabled={!canEdit}
                onChange={(key, rawValue) =>
                  setScoring((previous) => ({ ...previous, [key]: rawValue }))
                }
              />
            </SettingsGroup>
            <SettingsGroup title="Postseason">
              <PostseasonForm
                values={postseason}
                disabled={!canEdit}
                onChange={(key, value) =>
                  setPostseason((previous) => ({ ...previous, [key]: value }))
                }
              />
            </SettingsGroup>
            {draft.data && (
              <SettingsGroup title="Draft setup">
                <DraftSetupPanel draft={draft.data} canEdit={canEdit} />
              </SettingsGroup>
            )}
            <SettingsRow
              label="Invite link"
              value={activeInvite ? "Active" : "None"}
              onClick={() => setSheet("invite")}
            />
          </SettingsCard>

          <SettingsCard danger>
            <SettingsRow label="Delete league" danger centered onClick={() => setSheet("delete")} />
          </SettingsCard>
        </>
      )}

      {failure && <Alert severity="error">{failure}</Alert>}
      {updateSettings.isSuccess && !failure && <Alert severity="success">Settings saved.</Alert>}
      {isCommissioner && canEdit && dirty && (
        <Paper
          role="region"
          aria-label="Unsaved changes"
          sx={{
            position: "sticky",
            bottom: { xs: TAB_BAR_HEIGHT, md: 0 },
            zIndex: (theme) => theme.zIndex.appBar - 1,
            mt: 2,
            p: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderColor: "primary.main",
          }}
        >
          <Typography sx={{ flexGrow: 1 }}>Unsaved changes</Typography>
          <Button onClick={discard} disabled={updateSettings.isPending}>
            Discard
          </Button>
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={updateSettings.isPending}
          >
            Save
          </Button>
        </Paper>
      )}

      {sheet === "displayName" && (
        <EditTextSheet
          title="Display name"
          label="Display name"
          initial={displayName}
          maxLength={20}
          failure={nameError}
          onClose={close}
          onSave={async (value) => {
            const problem = await updateDisplayName(value);
            setNameError(problem);
            if (problem) throw new Error(problem);
          }}
        />
      )}
      {sheet === "teamName" && myTeam && (
        <EditTextSheet
          title="Team name"
          label="Team name"
          initial={myTeam.name}
          maxLength={40}
          failure={mutationError(renameTeam.error, "Couldn't rename your team. Try again.")}
          onClose={close}
          onSave={async (value) => {
            await renameTeam.mutateAsync(value);
          }}
        />
      )}
      {sheet === "leagueName" && info && (
        <EditTextSheet
          title="League name"
          label="League name"
          initial={info.name}
          maxLength={60}
          failure={mutationError(updateLeague.error, "Couldn't save the league name. Try again.")}
          onClose={close}
          onSave={(value) => updateLeague.mutateAsync({ name: value })}
        />
      )}
      {sheet === "notes" && info && (
        <EditTextSheet
          title="League note"
          label="League note"
          initial={notes}
          multiline
          allowEmpty
          maxLength={NOTES_MAX_LENGTH}
          helperText={NOTES_HINT}
          failure={mutationError(updateLeague.error, "Couldn't save the note. Try again.")}
          onClose={close}
          onSave={(value) => updateLeague.mutateAsync({ notes: value })}
        />
      )}
      {sheet === "teamCount" && (
        <EditTextSheet
          title="Number of teams"
          label="Number of teams"
          initial={String(season.numberTeams)}
          numeric
          maxLength={2}
          helperText={SETTING_HELP.numberTeams}
          validate={teamCountProblem}
          failure={mutationError(updateSeason.error, "Couldn't save the team count. Try again.")}
          onClose={close}
          onSave={(value) => updateSeason.mutateAsync({ numberTeams: Number(value) })}
        />
      )}
      {sheet === "members" && info && (
        <MembersSheet
          leagueId={leagueId}
          members={info.members}
          currentUserId={userId}
          onClose={close}
        />
      )}
      {sheet === "invite" && <InviteSheet leagueId={leagueId} onClose={close} />}
      {sheet === "delete" && info && (
        <DeleteLeagueDialog
          leagueId={leagueId}
          leagueName={info.name}
          seasonCount={info.seasons.length}
          onClose={close}
        />
      )}
    </Container>
  );
}

export default SettingsPage;
