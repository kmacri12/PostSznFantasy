import { Box, Button, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { usePastLeagues } from "../../api/queries";
import { seasonPaths } from "../../routes";

/** Leagues the member left: the finished seasons they played in stay readable. */
const PastLeagues = () => {
  const { data: pastLeagues = [] } = usePastLeagues(true);
  if (pastLeagues.length === 0) return null;
  return (
    <Box component="section" sx={{ mt: 3 }}>
      <Typography variant="overline" color="text.secondary" component="h2">
        Leagues you left
      </Typography>
      {pastLeagues.map((league) => (
        <Box key={league.id} sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{league.name}</Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {[...league.seasons]
              .sort((a, b) => b.year - a.year)
              .map((season) => (
                <Button
                  key={season.id}
                  size="small"
                  component={Link}
                  to={seasonPaths(league.id, season.year, season.current).home}
                >
                  {season.year}
                </Button>
              ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default PastLeagues;
