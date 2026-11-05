import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  IconButton,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import type React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateLeague, useScoringDefaults } from "../api/queries";
import ErrorState from "../components/common/ErrorState";
import DraftLockNotice from "../components/league/DraftLockNotice";
import ExhaustionWarning from "../components/league/ExhaustionWarning";
import RosterForm from "../components/settings/RosterForm";
import ScoringForm from "../components/settings/ScoringForm";
import TeamUnitChoice, { type TeamUnitValues } from "../components/settings/TeamUnitChoice";
import { leaguePath } from "../routes";
import { createLogger } from "../utils/logger";
import {
  countChangedFromDefaults,
  type ScoringSettingsState,
  toNumericScoring,
} from "../utils/scoring";

const logger = createLogger("CreateLeaguePage");

/** "Customize rules" walks these; the short path creates with the defaults. */
const STEPS = ["Roster", "Scoring", "Review"];
const MIN_TEAMS = 2;
const MAX_TEAMS = 14;

const DEFAULT_ROSTER = {
  number_teams: 6,
  roster_total: 18,
  roster_num_qb: 1,
  roster_num_rb: 2,
  roster_num_wr: 2,
  roster_num_te: 1,
  roster_num_flex_wr_rb_te: 1,
  roster_num_flex_wr_rb: 0,
  roster_num_flex_wr_te: 0,
  roster_num_flex_qb_wr_rb_te: 0,
  roster_num_k: 1,
  roster_num_dst: 1,
  roster_num_bench: 9,
  roster_max_qb: 2,
  roster_max_rb: 99,
  roster_max_wr: 99,
  roster_max_te: 99,
  roster_max_k: 2,
  roster_max_dst: 2,
};

/** Standard individual QB and K: the short path never asks, Customize rules does. */
const DEFAULT_TEAM_UNITS: TeamUnitValues = { team_qb: false, team_k: false };

const defaultRulesSummary = (roster: typeof DEFAULT_ROSTER): string =>
  `${roster.roster_num_qb} QB, ${roster.roster_num_rb} RB, ${roster.roster_num_wr} WR, ${roster.roster_num_te} TE, ${roster.roster_num_flex_wr_rb_te} FLEX, ${roster.roster_num_k} K, ${roster.roster_num_dst} DST, bench of ${roster.roster_num_bench}. Full PPR scoring. Every round counts the same (1x).`;

const CreateLeaguePage = ({
  onLeagueCreated,
}: {
  onLeagueCreated: (leagueId: number) => Promise<void>;
}) => {
  const navigate = useNavigate();
  const [leagueName, setLeagueName] = useState("");
  const [customizing, setCustomizing] = useState(false);
  const [step, setStep] = useState(0);
  const [rosterSettings, setRosterSettings] = useState(DEFAULT_ROSTER);

  const [teamUnits, setTeamUnits] = useState<TeamUnitValues>(DEFAULT_TEAM_UNITS);
  const [scoringSettings, setScoringSettings] = useState<ScoringSettingsState>({});
  const defaultsQuery = useScoringDefaults();
  const createLeague = useCreateLeague();
  const scoringDefaults = defaultsQuery.data ?? null;
  const defaultsFailed = defaultsQuery.isError;
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultsQuery.data) setScoringSettings(defaultsQuery.data);
  }, [defaultsQuery.data]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    try {
      const response = await createLeague.mutateAsync({
        leagueName: leagueName.trim(),
        rosterSettings,
        ...(customizing && { scoringSettings: toNumericScoring(scoringSettings) }),
        teamUnitSettings: { teamQb: teamUnits.team_qb, teamK: teamUnits.team_k },
      });

      const createdLeagueId = response.leagueId;
      if (!createdLeagueId) {
        setSubmitError(
          "Your league was created, but we couldn't open it. Find it on the home page.",
        );
        return;
      }
      await onLeagueCreated(createdLeagueId);
      navigate(leaguePath(createdLeagueId));
    } catch (error) {
      logger.error("Error creating league:", error);
      setSubmitError("Couldn't create the league. Try again.");
    }
  };

  const changedCount = scoringDefaults
    ? countChangedFromDefaults(scoringSettings, scoringDefaults)
    : 0;
  const isLastStep = step === STEPS.length - 1;
  const leagueValid = leagueName.trim() !== "";
  const setTeams = (count: number) =>
    setRosterSettings((previous) => ({
      ...previous,
      number_teams: Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, count)),
    }));

  if (!customizing) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 2.5, sm: 4 } }}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "grid", gap: 2, minHeight: { xs: "calc(100dvh - 120px)", sm: "auto" } }}
        >
          <Box>
            <Typography variant="h5" component="h1">
              Create a league
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Two details and you're in. Everything else has playoff-ready defaults.
            </Typography>
          </Box>
          {submitError && <Alert severity="error">{submitError}</Alert>}
          <TextField
            label="League name"
            value={leagueName}
            onChange={(event) => setLeagueName(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            required
            fullWidth
          />
          <Box>
            <Typography id="number-teams-label" variant="body2" color="text.secondary">
              Number of teams
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mt: 0.75 }}>
              <IconButton
                aria-label="Fewer teams"
                disabled={rosterSettings.number_teams <= MIN_TEAMS}
                onClick={() => setTeams(rosterSettings.number_teams - 1)}
                sx={{ width: 52, height: 52, border: 1, borderColor: "divider", borderRadius: 2 }}
              >
                <RemoveIcon />
              </IconButton>
              <Typography
                role="status"
                aria-labelledby="number-teams-label"
                sx={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 20,
                  fontWeight: 700,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  lineHeight: "50px",
                }}
              >
                {rosterSettings.number_teams}
              </Typography>
              <IconButton
                aria-label="More teams"
                disabled={rosterSettings.number_teams >= MAX_TEAMS}
                onClick={() => setTeams(rosterSettings.number_teams + 1)}
                sx={{ width: 52, height: 52, border: 1, borderColor: "divider", borderRadius: 2 }}
              >
                <AddIcon />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {MIN_TEAMS} to {MAX_TEAMS} teams. You can change this until the draft starts.
            </Typography>
          </Box>
          <ExhaustionWarning settings={rosterSettings} />
          <Card sx={{ p: 1.75 }}>
            <Typography variant="subtitle2">Default rules</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {defaultRulesSummary(rosterSettings)}
            </Typography>
          </Card>
          <Button
            type="button"
            color="primary"
            sx={{ justifyContent: "flex-start" }}
            onClick={() => {
              setStep(0);
              setCustomizing(true);
            }}
          >
            Customize rules
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            type="submit"
            variant="contained"
            size="large"
            sx={{ minHeight: 52 }}
            disabled={!leagueValid || createLeague.isPending}
          >
            Create league
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Customize rules
      </Typography>
      {submitError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {submitError}
        </Alert>
      )}
      <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box
        component="form"
        onSubmit={(event: React.FormEvent) => {
          event.preventDefault();
          if (isLastStep) handleSubmit(event);
          else setStep((current) => current + 1);
        }}
      >
        {step === 0 && (
          <>
            <DraftLockNotice />
            <ExhaustionWarning settings={rosterSettings} />
            <TeamUnitChoice
              values={teamUnits}
              onChange={(key, value) => setTeamUnits((previous) => ({ ...previous, [key]: value }))}
            />
            <RosterForm
              values={rosterSettings}
              onChange={(next) => setRosterSettings(next as typeof rosterSettings)}
            />
          </>
        )}

        {step === 1 && defaultsFailed && (
          <ErrorState
            message="Couldn't load the default scoring settings. Check your connection and try again."
            onRetry={() => defaultsQuery.refetch()}
          />
        )}

        {step === 1 && scoringDefaults && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography color="text.secondary">
                Defaults are full PPR with 0.1 per kicker field-goal yard.
              </Typography>
              <Button
                type="button"
                size="small"
                onClick={() => setScoringSettings(scoringDefaults)}
              >
                Reset to defaults
              </Button>
            </Box>
            <ScoringForm
              values={scoringSettings}
              onChange={(key, rawValue) =>
                setScoringSettings((previous) => ({ ...previous, [key]: rawValue }))
              }
            />
          </>
        )}

        {step === 2 && (
          <Card sx={{ p: 3 }}>
            <DraftLockNotice />
            <ExhaustionWarning settings={rosterSettings} />
            <Typography variant="h6">{leagueName}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {rosterSettings.number_teams} teams · {rosterSettings.roster_total} roster spots
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Starters: {rosterSettings.roster_num_qb} QB, {rosterSettings.roster_num_rb} RB,{" "}
              {rosterSettings.roster_num_wr} WR, {rosterSettings.roster_num_te} TE,{" "}
              {rosterSettings.roster_num_flex_wr_rb_te} FLEX, {rosterSettings.roster_num_k} K,{" "}
              {rosterSettings.roster_num_dst} DST
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Team QB {teamUnits.team_qb ? "on" : "off"} · Team K {teamUnits.team_k ? "on" : "off"}
            </Typography>
            {scoringDefaults && (
              <>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Scoring: {scoringSettings.scoring_passing_td} pt pass TD,{" "}
                  {scoringSettings.scoring_receiving_reception} pt per reception,{" "}
                  {scoringSettings.scoring_passing_yard} / {scoringSettings.scoring_rushing_yard} /{" "}
                  {scoringSettings.scoring_receiving_yard} per pass / rush / rec yard
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {changedCount === 0
                    ? "Scoring uses the default full PPR settings."
                    : `${changedCount} scoring setting${changedCount === 1 ? "" : "s"} changed from the defaults.`}
                </Typography>
              </>
            )}
          </Card>
        )}

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
          <Button
            type="button"
            color="inherit"
            onClick={() => (step === 0 ? setCustomizing(false) : setStep((current) => current - 1))}
          >
            Back
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLastStep && (!scoringDefaults || createLeague.isPending)}
          >
            {isLastStep ? "Create league" : "Next"}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default CreateLeaguePage;
