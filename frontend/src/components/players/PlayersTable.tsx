import {
  Alert,
  Box,
  Card,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useConfig, usePlayerSeasonStats, useUserLeagues } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import { tokens } from "../../theme";
import {
  filterPlayers,
  formatPoints,
  type PlayerSeasonStats,
  POSITIONS,
  type PositionFilter,
  STAT_COLUMNS,
  sortPlayers,
  statValue,
  teamOf,
} from "./playerStats";

const PlayersTable = () => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const { userId } = useUser();
  const { data: config } = useConfig();
  const { data: leagues = [] } = useUserLeagues(userId !== null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [pickedSeason, setPickedSeason] = useState<string | null>(null);
  const [position, setPosition] = useState<PositionFilter>("QB");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("fantasyPoints");

  // Follows the configured season until the user picks another one.
  const currentSeason = config?.season;
  const season = pickedSeason ?? (currentSeason ? String(currentSeason) : undefined);
  const seasonOptions = currentSeason
    ? [currentSeason, currentSeason - 1, currentSeason - 2].map(String)
    : [];

  const requestedLeague = searchParams.get("leagueId");
  const league = leagues.find((l) => String(l.id) === requestedLeague) ?? leagues[0];

  const stats = usePlayerSeasonStats<PlayerSeasonStats>(season, league?.id);
  const columns = STAT_COLUMNS[position];
  const rows = useMemo(
    () => sortPlayers(filterPlayers(stats.data ?? [], position, search), sortKey),
    [stats.data, position, search, sortKey],
  );
  const hasPoints = league !== undefined;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr 1fr", sm: "140px 140px 1fr" },
          mb: 1.5,
        }}
      >
        <FormControl size="small">
          <InputLabel id="season-select-label">Season</InputLabel>
          <Select
            labelId="season-select-label"
            value={season ?? ""}
            label="Season"
            onChange={(e: SelectChangeEvent) => setPickedSeason(e.target.value)}
          >
            {seasonOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel id="position-select-label">Position</InputLabel>
          <Select
            labelId="position-select-label"
            value={position}
            label="Position"
            onChange={(e: SelectChangeEvent) => setPosition(e.target.value as PositionFilter)}
          >
            {POSITIONS.map((pos) => (
              <MenuItem key={pos} value={pos}>
                {pos}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Search player"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
        />
      </Box>

      {hasPoints ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Fantasy points use
          </Typography>
          {leagues.length > 1 ? (
            <Select
              size="small"
              value={String(league.id)}
              onChange={(e) => setSearchParams({ leagueId: e.target.value })}
              inputProps={{ "aria-label": "Scoring league" }}
            >
              {leagues.map((l) => (
                <MenuItem key={l.id} value={String(l.id)}>
                  {l.name}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Chip size="small" label={league.name} />
          )}
          <Typography variant="body2" color="text.secondary">
            scoring
          </Typography>
        </Box>
      ) : (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Join or create a league to see fantasy points under its scoring settings.
        </Alert>
      )}

      {stats.isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {!stats.isLoading && rows.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          No player statistics found.
        </Typography>
      )}

      {rows.length > 0 && isPhone && (
        <Box sx={{ display: "grid", gap: 1 }} aria-label="Players">
          {rows.map((row, index) => (
            <Card key={row.playerId} sx={{ p: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography color="text.secondary" sx={{ width: 24 }}>
                  {index + 1}
                </Typography>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 700 }}>
                    {row.player?.name ?? "Unknown"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.player?.position} · {teamOf(row)}
                  </Typography>
                </Box>
                {hasPoints && (
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="h6" sx={{ color: tokens.gold, lineHeight: 1 }}>
                      {formatPoints(row.fantasyPoints)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      fantasy pts
                    </Typography>
                  </Box>
                )}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                {columns.map((column) => (
                  <Chip
                    key={column.key}
                    size="small"
                    variant="outlined"
                    label={`${column.header} ${statValue(row, column.key)}`}
                  />
                ))}
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {rows.length > 0 && !isPhone && (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={40}>#</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortKey === "name"}
                    direction="asc"
                    onClick={() => setSortKey("name")}
                  >
                    Player
                  </TableSortLabel>
                </TableCell>
                <TableCell>Team</TableCell>
                {hasPoints && (
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === "fantasyPoints"}
                      direction="desc"
                      onClick={() => setSortKey("fantasyPoints")}
                    >
                      Fantasy Pts
                    </TableSortLabel>
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key} align="right">
                    <TableSortLabel
                      active={sortKey === column.key}
                      direction="desc"
                      onClick={() => setSortKey(column.key)}
                    >
                      {column.header}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.playerId} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>
                      {row.player?.name ?? "Unknown"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.player?.position}
                    </Typography>
                  </TableCell>
                  <TableCell>{teamOf(row)}</TableCell>
                  {hasPoints && (
                    <TableCell align="right" sx={{ color: tokens.gold, fontWeight: 700 }}>
                      {formatPoints(row.fantasyPoints)}
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.key} align="right">
                      {statValue(row, column.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default PlayersTable;
