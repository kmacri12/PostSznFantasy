import { Box, Card, CardContent, Chip, Divider, Grid, Typography } from "@mui/material";
import type React from "react";

interface LeagueInfoProps {
  leagueName?: string;
  season?: number | string;
  totalTeams?: number;
  commissionerName?: string;
  draftType?: string;
  status?: string;
}

const LeagueInfo: React.FC<LeagueInfoProps> = ({
  leagueName = "Playoff League",
  season = 2024,
  totalTeams = 12,
  commissionerName = "Commissioner",
  draftType = "Snake Draft",
  status = "Active",
}) => {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ mb: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h5" component="h2">
            {leagueName}
          </Typography>
          <Chip label={status} color="primary" size="small" />
        </Box>
        <Divider sx={{ my: 1.5 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="textSecondary">
              Season
            </Typography>
            <Typography variant="body1">{season}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="textSecondary">
              Total Teams
            </Typography>
            <Typography variant="body1">{totalTeams}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="textSecondary">
              Commissioner
            </Typography>
            <Typography variant="body1">{commissionerName}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="textSecondary">
              Draft Type
            </Typography>
            <Typography variant="body1">{draftType}</Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default LeagueInfo;
