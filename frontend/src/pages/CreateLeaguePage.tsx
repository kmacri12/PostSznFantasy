import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  FormControl,
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
import RosterSettingsComponent from "../components/settings/RosterSettingsComponent";
import ScoringCarryingSettingsComponent from "../components/settings/ScoringCarryingSettingsComponent";
import ScoringDSTSettingsComponent from "../components/settings/ScoringDSTSettingsComponent";
import ScoringKickingSettingsComponent from "../components/settings/ScoringKickingSettingsComponent";
import ScoringPassingSettingsComponent from "../components/settings/ScoringPassingSettingsComponent";
import ScoringReceivingSettingsComponent from "../components/settings/ScoringReceivingSettingsComponent";
import ScoringRushingSettingsComponent from "../components/settings/ScoringRushingSettingsComponent";
import ScoringSpecialTeamsSettingsComponent from "../components/settings/ScoringSpecialTeamsSettingsComponent";
import { createLogger } from "../utils/logger";
import {
  type ScoringSettingsState,
  countChangedFromDefaults,
  toNumericScoring,
} from "../utils/scoring";

const logger = createLogger("CreateLeaguePage");

const STEPS = ["League", "Roster", "Scoring", "Review"];

type ExpandedSection =
  | "roster"
  | "passing"
  | "rushing"
  | "receiving"
  | "carrying"
  | "kicking"
  | "specialTeams"
  | "defense";

const CreateLeaguePage = ({
  onLeagueCreated,
}: {
  onLeagueCreated: (leagueId: number) => Promise<void>;
}) => {
  const navigate = useNavigate();
  const [leagueName, setLeagueName] = useState("MyLeague");
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState<Record<ExpandedSection, boolean>>({
    roster: true,
    passing: false,
    rushing: false,
    receiving: false,
    carrying: false,
    kicking: false,
    specialTeams: false,
    defense: false,
  });

  // Roster Settings
  const [rosterSettings, setRosterSettings] = useState({
    number_teams: 12,
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

  const [scoringSettings, setScoringSettings] = useState<ScoringSettingsState>({});
  const defaultsQuery = useScoringDefaults();
  const createLeague = useCreateLeague();
  const scoringDefaults = defaultsQuery.data ?? null;
  const defaultsFailed = defaultsQuery.isError;
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultsQuery.data) setScoringSettings(defaultsQuery.data);
  }, [defaultsQuery.data]);

  const handleExpandClick = (section: ExpandedSection) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    try {
      const response = await createLeague.mutateAsync({
        leagueName,
        rosterSettings,
        scoringSettings: toNumericScoring(scoringSettings),
      });

      const createdLeagueId = response.leagueId;
      if (!createdLeagueId) {
        setSubmitError("League was created but the server returned no league id.");
        return;
      }
      await onLeagueCreated(createdLeagueId);
      navigate(`/league/${createdLeagueId}`);
    } catch (error) {
      logger.error("Error creating league:", error);
      setSubmitError("Could not create the league. Please try again.");
    }
  };

  const scoringSection = (
    key: ExpandedSection,
    Component: React.ComponentType<{
      expanded: boolean;
      scoringSettings: typeof scoringSettings;
      setScoringSettings: (settings: ScoringSettingsState) => void;
      handleExpandClick: () => void;
    }>,
  ) => (
    <Box sx={{ mb: 2 }}>
      <Component
        expanded={expanded[key]}
        scoringSettings={scoringSettings}
        setScoringSettings={(newSettings) =>
          setScoringSettings((prevSettings) => ({ ...prevSettings, ...newSettings }))
        }
        handleExpandClick={() => handleExpandClick(key)}
      />
    </Box>
  );

  const changedCount = scoringDefaults
    ? countChangedFromDefaults(scoringSettings, scoringDefaults)
    : 0;
  const isLastStep = step === STEPS.length - 1;
  const canAdvance = step !== 0 || (leagueName.trim() !== "" && rosterSettings.number_teams >= 2);

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
              <Grid item xs={12} sm={8}>
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
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel htmlFor="number-teams">Teams</InputLabel>
                  <OutlinedInput
                    id="number-teams"
                    type="number"
                    value={rosterSettings.number_teams || ""}
                    onChange={(e) =>
                      setRosterSettings({
                        ...rosterSettings,
                        number_teams: Number.parseInt(e.target.value, 10) || 0,
                      })
                    }
                    label="Teams"
                  />
                </FormControl>
              </Grid>
            </Grid>
          </Card>
        )}

        {step === 1 && (
          <RosterSettingsComponent
            expanded={expanded.roster}
            rosterSettings={rosterSettings}
            setRosterSettings={(newSettings) =>
              setRosterSettings((prevSettings) => ({ ...prevSettings, ...newSettings }))
            }
            handleExpandClick={() => handleExpandClick("roster")}
          />
        )}

        {step === 2 && defaultsFailed && (
          <Alert severity="error">
            Couldn't load the default scoring settings. Check that the API is running and reload.
          </Alert>
        )}

        {step === 2 && scoringDefaults && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography color="text.secondary">
                Defaults follow Sleeper's standard PPR.
              </Typography>
              <Button
                type="button"
                size="small"
                onClick={() => setScoringSettings(scoringDefaults)}
              >
                Reset to Sleeper defaults
              </Button>
            </Box>
            {scoringSection("passing", ScoringPassingSettingsComponent)}
            {scoringSection("rushing", ScoringRushingSettingsComponent)}
            {scoringSection("receiving", ScoringReceivingSettingsComponent)}
            {scoringSection("carrying", ScoringCarryingSettingsComponent)}
            {scoringSection("kicking", ScoringKickingSettingsComponent)}
            {scoringSection("specialTeams", ScoringSpecialTeamsSettingsComponent)}
            {scoringSection("defense", ScoringDSTSettingsComponent)}
          </>
        )}

        {step === 3 && (
          <Card sx={{ p: 3 }}>
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
                    ? "Scoring matches Sleeper's standard PPR defaults."
                    : `${changedCount} scoring setting${changedCount === 1 ? "" : "s"} changed from Sleeper defaults.`}
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
