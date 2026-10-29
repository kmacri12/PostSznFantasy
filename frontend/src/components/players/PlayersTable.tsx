import {
  FormControl,
  Grid,
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
  TextField,
} from "@mui/material";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import "./PlayersTable.css";
import { createLogger } from "../../utils/logger";

const logger = createLogger("PlayersTable");

export interface PlayerInfo {
  id: number;
  name: string;
  position: string;
  teamAbv?: string;
  jerseyNum?: string;
  team?: {
    teamAbv?: string;
  };
}

export interface PlayerSeasonStats {
  season: string;
  playerId: number;
  player?: PlayerInfo;
  passingCompletions?: number;
  passingAttempts?: number;
  passingYards?: number;
  passingTouchdowns?: number;
  passingInterceptions?: number;
  rushingCarries?: number;
  rushingYards?: number;
  rushingTouchdowns?: number;
  carryingFumblesLost?: number;
  receivingReceptions?: number;
  receivingYards?: number;
  receivingTouchdowns?: number;
  kickingFgMade?: number;
  kickingFgMissed?: number;
  kickingXpMade?: number;
  kickingXpMissed?: number;
  dstPointsAllowed?: number;
  dstYardsAllowed?: number;
  dstSacks?: number;
  dstInterceptions?: number;
  dstDefTd?: number;
}

const PlayersTable = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  const [selectedSeason, setSelectedSeason] = useState("2024");
  const [selectedPosition, setSelectedPosition] = useState("QB");
  const [searchQuery, setSearchQuery] = useState("");
  const [playerStats, setPlayerStats] = useState<PlayerSeasonStats[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    axios
      .get(`${apiUrl}/api/players/player-season-stats`)
      .then((response) => {
        setPlayerStats(response.data || []);
      })
      .catch((error) => {
        logger.error("Error fetching player stats:", error);
      });
  }, [apiUrl]);

  const filteredData = useMemo(() => {
    return playerStats.filter((row) => {
      const pos = row.player?.position || "";
      const matchesPosition =
        selectedPosition === "FLX" ? ["RB", "WR", "TE"].includes(pos) : pos === selectedPosition;

      const matchesSeason = !selectedSeason || row.season === selectedSeason;
      const matchesSearch =
        !searchQuery ||
        (row.player?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      return matchesPosition && matchesSeason && matchesSearch;
    });
  }, [playerStats, selectedPosition, selectedSeason, searchQuery]);

  const positionColumns = useMemo<ColumnDef<PlayerSeasonStats>[]>(() => {
    switch (selectedPosition) {
      case "QB":
        return [
          { header: "Cmp", accessorKey: "passingCompletions" },
          { header: "Att", accessorKey: "passingAttempts" },
          { header: "Pass Yds", accessorKey: "passingYards" },
          { header: "Pass TD", accessorKey: "passingTouchdowns" },
          { header: "INT", accessorKey: "passingInterceptions" },
          { header: "Rush Yds", accessorKey: "rushingYards" },
          { header: "Rush TD", accessorKey: "rushingTouchdowns" },
        ];
      case "RB":
      case "WR":
      case "TE":
      case "FLX":
        return [
          { header: "Rec", accessorKey: "receivingReceptions" },
          { header: "Rec Yds", accessorKey: "receivingYards" },
          { header: "Rec TD", accessorKey: "receivingTouchdowns" },
          { header: "Carries", accessorKey: "rushingCarries" },
          { header: "Rush Yds", accessorKey: "rushingYards" },
          { header: "Rush TD", accessorKey: "rushingTouchdowns" },
          { header: "Fumbles Lost", accessorKey: "carryingFumblesLost" },
        ];
      case "PK":
      case "K":
        return [
          { header: "FG Made", accessorKey: "kickingFgMade" },
          { header: "FG Miss", accessorKey: "kickingFgMissed" },
          { header: "XP Made", accessorKey: "kickingXpMade" },
          { header: "XP Miss", accessorKey: "kickingXpMissed" },
        ];
      case "DST":
        return [
          { header: "Pts Allowed", accessorKey: "dstPointsAllowed" },
          { header: "Yds Allowed", accessorKey: "dstYardsAllowed" },
          { header: "Sacks", accessorKey: "dstSacks" },
          { header: "INT", accessorKey: "dstInterceptions" },
          { header: "Def TD", accessorKey: "dstDefTd" },
        ];
      default:
        return [];
    }
  }, [selectedPosition]);

  const columns = useMemo<ColumnDef<PlayerSeasonStats>[]>(
    () => [
      {
        header: "Name",
        accessorFn: (row) => row.player?.name ?? "Unknown",
        id: "name",
      },
      {
        header: "Pos",
        accessorFn: (row) => row.player?.position ?? "-",
        id: "position",
      },
      {
        header: "Team",
        accessorFn: (row) => row.player?.teamAbv || row.player?.team?.teamAbv || "-",
        id: "team",
      },
      ...positionColumns,
    ],
    [positionColumns],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div style={{ padding: "16px" }}>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="season-select-label">Season</InputLabel>
            <Select
              labelId="season-select-label"
              value={selectedSeason}
              label="Season"
              onChange={(e: SelectChangeEvent) => setSelectedSeason(e.target.value)}
            >
              <MenuItem value="2025">2025</MenuItem>
              <MenuItem value="2024">2024</MenuItem>
              <MenuItem value="2023">2023</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="position-select-label">Position</InputLabel>
            <Select
              labelId="position-select-label"
              value={selectedPosition}
              label="Position"
              onChange={(e: SelectChangeEvent) => setSelectedPosition(e.target.value)}
            >
              <MenuItem value="QB">QB</MenuItem>
              <MenuItem value="RB">RB</MenuItem>
              <MenuItem value="WR">WR</MenuItem>
              <MenuItem value="TE">TE</MenuItem>
              <MenuItem value="FLX">FLX</MenuItem>
              <MenuItem value="PK">PK</MenuItem>
              <MenuItem value="DST">DST</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            size="small"
            label="Search player"
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table className="players-table">
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableCell
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        cursor: canSort ? "pointer" : "default",
                        fontWeight: "bold",
                        userSelect: "none",
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === "asc" ? " 🔼" : sorted === "desc" ? " 🔽" : ""}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center">
                  No player statistics found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default PlayersTable;
