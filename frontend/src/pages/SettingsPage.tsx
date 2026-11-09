import {
  Alert,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useBlocker } from "react-router-dom";
import {
  useDraft,
  useInvite,
  useLeagueInfo,
  useLeagueSettings,
  useSetAvatar,
  useStandings,
  useUpdateLeague,
  useUpdateSeason,
  useUpdateSettings,
} from "../api/queries";
import AvatarSheet from "../components/avatar/AvatarSheet";
import ErrorState from "../components/common/ErrorState";
import { mutationError } from "../components/common/friendlyError";
import LoadingState from "../components/common/LoadingState";
import PictureAvatar from "../components/common/PictureAvatar";
import ArchivedNotice from "../components/league/ArchivedNotice";
import DeleteLeagueDialog from "../components/settings/DeleteLeagueDialog";
import { valuesEqual } from "../components/settings/dirty";
import EditTextSheet from "../components/settings/EditTextSheet";
import InviteSheet from "../components/settings/InviteSheet";
import MembersSheet from "../components/settings/MembersSheet";
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
import { MULTIPLIER_RULE, numberProblems, rosterProblems } from "../utils/numberField";
import { scoringProblems } from "../utils/scoring";

type Sheet =
  | "leaguePicture"
  | "leagueName"
  | "notes"
  | "teamCount"
  | "members"
  | "invite"
  | "delete"
  | null;

const PICTURE_FAILURE = "Couldn't save the picture. Try again.";

const UNSAVED_WARNING = "You have unsaved changes to the league settings.";

const multiplierProblems = (values: PostseasonValues) =>
  numberProblems(values, (key) => (key.startsWith("multiplier_") ? MULTIPLIER_RULE : null));

const teamCountProblem = (value: string) => {
  const count = Number(value);
  return Number.isInteger(count) && count >= 2 && count <= 14
    ? null
    : "Enter a number from 2 to 14.";
};

/**
 * League settings, opened from the cog on the League page. Everyone sees the same rows;
 * commissioners edit them (rows that open sheets, rules as accordions), members only read.
 */
function SettingsPage() {
  const { leagueId, seasonId, season } = useSeasonContext();
  const { userId } = useUser();
  const info = useLeagueInfo(leagueId, !season.isFormerMember).data;
  const archived = season.finished;
  const settingsQuery = useLeagueSettings(seasonId);
  const draft = useDraft(seasonId);
  const standings = useStandings(seasonId).data;
  const updateSettings = useUpdateSettings(seasonId);
  const updateLeague = useUpdateLeague(leagueId);
  const updateSeason = useUpdateSeason(seasonId);
  const leaguePicture = useSetAvatar({ kind: "league", id: leagueId });
  const isCommissioner = info?.myRole === "commissioner";
  const canEdit = season.canCommission;
  const invite = useInvite(leagueId, isCommissioner);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [roster, setRoster] = useState<SettingsValues>({});
  const [scoring, setScoring] = useState<SettingsValues>({});
  const [postseason, setPostseason] = useState<PostseasonValues>({});
  const [confirmingRescore, setConfirmingRescore] = useState(false);

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

  const rosterErrors = useMemo(() => rosterProblems(roster), [roster]);
  const scoringErrors = useMemo(() => scoringProblems(scoring), [scoring]);
  const multiplierErrors = useMemo(() => multiplierProblems(postseason), [postseason]);
  const invalid =
    Object.keys(rosterErrors).length +
      Object.keys(scoringErrors).length +
      Object.keys(multiplierErrors).length >
    0;
  const guarded = dirty && season.canCommission;
  const blocker = useBlocker(guarded);

  useEffect(() => {
    if (!guarded) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [guarded]);

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

  // Only called once every field validates, so Number() never sees a blank or half-typed value.
  const save = () =>
    updateSettings.mutateAsync({
      ...Object.fromEntries(Object.entries(roster).map(([key, value]) => [key, Number(value)])),
      ...Object.fromEntries(Object.entries(scoring).map(([key, value]) => [key, Number(value)])),
      ...Object.fromEntries(
        Object.entries(postseason).map(([key, value]) => [
          key,
          key.startsWith("multiplier_") ? Number(value) : value,
        ]),
      ),
    });

  // Scoring and postseason changes re-score every finished round, so ask once games have been played.
  const rescoresPlayedRounds =
    !valuesEqual(baseline?.scoring ?? {}, scoring) ||
    !valuesEqual(baseline?.postseason ?? {}, postseason);
  // Before the draft there are no standings to change, whatever games the schedule holds.
  const gamesPlayed =
    standings?.phase === "live" &&
    ((standings.gamesFinal ?? 0) + (standings.gamesInProgress ?? 0) > 0 || standings.round > 1);
  const requestSave = () => {
    if (rescoresPlayedRounds && gamesPlayed) setConfirmingRescore(true);
    else void save().catch(() => {});
  };

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
  const notes = info?.notes ?? "";
  const activeInvite = invite.data && !invite.data.revoked;
  const failure = mutationError(updateSettings.error, "Couldn't save the settings. Try again.");
  const close = () => setSheet(null);

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        League settings
      </Typography>

      {info && (
        <>
          {archived && <ArchivedNotice what="the roster, scoring and team count" />}
          {started && !archived && isCommissioner && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              The draft has started, so team count, roster slots and position caps are locked.
              Scoring and round multipliers can still change.
            </Alert>
          )}
          <SettingsCard>
            <SettingsRow
              label="League picture"
              value={
                <PictureAvatar url={info.avatarUrl} name={info.name} size={32} fallback="tile" />
              }
              onClick={isCommissioner ? () => setSheet("leaguePicture") : undefined}
            />
            <SettingsRow
              label={isCommissioner ? "Edit league name" : "League name"}
              value={info.name}
              onClick={isCommissioner ? () => setSheet("leagueName") : undefined}
            />
            <SettingsRow
              label={isCommissioner ? "Edit league note" : "League note"}
              value={notes || "No note yet"}
              onClick={isCommissioner ? () => setSheet("notes") : undefined}
            />
            <SettingsRow
              label="Number of teams"
              value={`${season.numberTeams} teams${started ? " · locked" : ""}`}
              onClick={canEdit && !started ? () => setSheet("teamCount") : undefined}
            />
            <SettingsRow
              label={isCommissioner ? "Edit members" : "Members"}
              value={`${info.members.length} members`}
              onClick={() => setSheet("members")}
            />
            <SettingsGroup title="Roster">
              <RosterForm
                values={roster}
                onChange={setRoster}
                errors={rosterErrors}
                disabled={!canEdit || started}
              />
            </SettingsGroup>
            <SettingsGroup title="Scoring">
              <ScoringForm
                values={scoring}
                errors={scoringErrors}
                disabled={!canEdit}
                onChange={(key, rawValue) =>
                  setScoring((previous) => ({ ...previous, [key]: rawValue }))
                }
              />
            </SettingsGroup>
            <SettingsGroup title="Postseason">
              <PostseasonForm
                values={postseason}
                errors={multiplierErrors}
                disabled={!canEdit}
                onChange={(key, value) =>
                  setPostseason((previous) => ({ ...previous, [key]: value }))
                }
              />
            </SettingsGroup>
            {isCommissioner && (
              <SettingsRow
                label="Invite link"
                value={activeInvite ? "Active" : "None"}
                onClick={() => setSheet("invite")}
              />
            )}
          </SettingsCard>

          {isCommissioner && (
            <SettingsCard danger>
              <SettingsRow
                label="Delete league"
                danger
                centered
                onClick={() => setSheet("delete")}
              />
            </SettingsCard>
          )}
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
          <Typography sx={{ flexGrow: 1 }}>
            {invalid ? "Fix the highlighted fields to save" : "Unsaved changes"}
          </Typography>
          <Button onClick={discard} disabled={updateSettings.isPending}>
            Discard
          </Button>
          <Button
            variant="contained"
            onClick={requestSave}
            disabled={updateSettings.isPending || invalid}
          >
            Save
          </Button>
        </Paper>
      )}

      <Dialog
        open={confirmingRescore}
        onClose={() => setConfirmingRescore(false)}
        aria-labelledby="rescore-title"
      >
        <DialogTitle id="rescore-title">Re-score every team?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Games have already been played. This re-scores every team's finished rounds and changes
            standings. The Feed will show the change.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingRescore(false)}>Keep editing</Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirmingRescore(false);
              void save().catch(() => {});
            }}
          >
            Save and re-score
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={blocker.state === "blocked"} aria-labelledby="leave-title">
        <DialogTitle id="leave-title">Leave without saving?</DialogTitle>
        <DialogContent>
          <DialogContentText>{UNSAVED_WARNING} They will be lost.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>Stay</Button>
          <Button color="error" onClick={() => blocker.proceed?.()}>
            Leave
          </Button>
        </DialogActions>
      </Dialog>

      {sheet === "leaguePicture" && info && (
        <AvatarSheet
          title="League picture"
          name={info.name}
          currentUrl={info.avatarUrl}
          fallback="tile"
          failure={mutationError(leaguePicture.error, PICTURE_FAILURE)}
          onClose={close}
          onSave={async (picture) => {
            await leaguePicture.mutateAsync(picture);
          }}
          onRemove={async () => {
            await leaguePicture.mutateAsync(null);
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
          readOnly={!isCommissioner}
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
