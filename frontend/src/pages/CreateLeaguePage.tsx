import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  OutlinedInput,
  Step,
  StepLabel,
  Stepper,
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
import { createLogger } from "../utils/logger";
import {
  countChangedFromDefaults,
  type ScoringSettingsState,
  toNumericScoring,
} from "../utils/scoring";

const logger = createLogger("CreateLeaguePage");

const STEPS = ["League", "Roster", "Scoring", "Review"];

const CreateLeaguePage = ({
  onLeagueCreated,
}: {
  onLeagueCreated: (leagueId: number) => Promise<void>;
}) => {
  const navigate = useNavigate();
  const [leagueName, setLeagueName] = useState("MyLeague");
  const [step, setStep] = useState(0);

  // Roster Settings
  const [rosterSettings, setRosterSettings] = useState({
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
  });

  const [teamUnits, setTeamUnits] = useState<TeamUnitValues>({ team_qb: null, team_k: null });
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
        leagueName,
        rosterSettings,
        scoringSettings: toNumericScoring(scoringSettings),
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
      navigate(`/league/${createdLeagueId}`);
    } catch (error) {
      logger.error("Error creating league:", error);
      setSubmitError("Couldn't create the league. Try again.");
    }
  };

  const changedCount = scoringDefaults
    ? countChangedFromDefaults(scoringSettings, scoringDefaults)
    : 0;
  const isLastStep = step === STEPS.length - 1;
  const leagueStepValid =
    leagueName.trim() !== "" &&
    rosterSettings.number_teams >= 2 &&
    rosterSettings.number_teams <= 14;
  const teamUnitsChosen = teamUnits.team_qb !== null && teamUnits.team_k !== null;
  const canAdvance = (step !== 0 || leagueStepValid) && (step !== 1 || teamUnitsChosen);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Create a league
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
          <Card sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 8 }}>
                <FormControl fullWidth>
                  <InputLabel htmlFor="league-name">League name</InputLabel>
                  <OutlinedInput
                    id="league-name"
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                    label="League name"
                    required
                  />
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel htmlFor="number-teams">Teams</InputLabel>
                  <OutlinedInput
                    id="number-teams"
                    type="number"
                    inputProps={{ min: 2, max: 14 }}
                    value={rosterSettings.number_teams || ""}
                    onChange={(e) =>
                      setRosterSettings({
                        ...rosterSettings,
                        number_teams: Number.parseInt(e.target.value, 10) || 0,
                      })
                    }
                    label="Teams"
                  />
                  <FormHelperText>2 to 14 teams</FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
            <Box sx={{ mt: 2 }}>
              <ExhaustionWarning settings={rosterSettings} />
            </Box>
          </Card>
        )}

        {step === 1 && (
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

        {step === 2 && defaultsFailed && (
          <ErrorState
            message="Couldn't load the default scoring settings. Check your connection and try again."
            onRetry={() => defaultsQuery.refetch()}
          />
        )}

        {step === 2 && scoringDefaults && (
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

        {step === 3 && (
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
            disabled={step === 0}
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canAdvance || (isLastStep && !scoringDefaults)}
          >
            {isLastStep ? "Create league" : "Next"}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default CreateLeaguePage;
