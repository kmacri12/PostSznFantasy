import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTable, useSortBy } from "react-table";
import "./PlayersTable.css";
import axios from "axios";

interface PlayerStat {
  carrying_fumbles: number;
  carrying_fumbles_lost: number;
  dst_def_td: number;
  dst_fumbles_recovered: number;
  dst_interceptions: number;
  dst_points_allowed: number;
  dst_sacks: number;
  dst_safeties: number;
  dst_yards_allowed: number;
  kick_return_td: number;
  kick_return_yards: number;
  kicking_fg_missed: number;
  kicking_fg_yards_made: number[];
  kicking_xp_made: number;
  kicking_xp_missed: number;
  passing_attempts: number;
  passing_completions: number;
  passing_interceptions: number;
  passing_sacked: number;
  passing_sacked_yards: number;
  passing_touchdowns: number;
  passing_two_point_conversions: number;
  passing_yards: number;
  player: {
    birthday: string;
    espn_headshot_url: string;
    exp: string;
    height: string;
    id: number;
    jersey_num: string;
    name: string;
    position: string;
    team_id: number;
    weight: string;
    team: {
      id: number;
      team_abv: string;
      team_city: string;
      team_logo_url: string;
      team_name: string;
    };
  };
  player_id: number;
  punt_return_td: number;
  punt_return_yards: number;
  receiving_long_reception: number;
  receiving_receptions: number;
  receiving_targets: number;
  receiving_touchdowns: number;
  receiving_two_point_conversions: number;
  receiving_yards: number;
  rushing_carries: number;
  rushing_long_rush: number;
  rushing_touchdowns: number;
  rushing_two_point_conversions: number;
  rushing_yards: number;
  season: string;
}

const PlayersTable = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  const [selectedSeason, setSelectedSeason] = useState("2023");
  const [selectedPosition, setSelectedPosition] = useState("QB");
  const [searchQuery, setSearchQuery] = useState("");
  const [playerStats, setPlayerStats] = useState<[]>([]);

  useEffect(() => {
    axios
      .get(`${apiUrl}/api/players/player_season_stats`)
      .then((response) => {
        setPlayerStats(response.data);
        // setLoading(false);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  const getPositionColumns = useCallback((position: string) => {
    switch (position) {
      case "QB":
        return [
          {
            Header: "Passing",
            columns: [
              { Header: "Completions", accessor: "passing_completions" },
              { Header: "Attempts", accessor: "passing_attempts" },
              { Header: "Yards", accessor: "passing_yards" },
              { Header: "Touchdowns", accessor: "passing_touchdowns" },
            ],
          },
          {
            Header: "Rushing",
            columns: [
              { Header: "Carries", accessor: "rushing_carries" },
              { Header: "Yards", accessor: "rushing_yards" },
              { Header: "Touchdowns", accessor: "rushing_touchdowns" },
              { Header: "Fumbles Lost", accessor: "carrying_fumbles_lost" },
            ],
          },
        ];
      case "RB":
      case "WR":
      case "TE":
      case "FLX":
        return [
          {
            Header: "Receiving",
            columns: [
              { Header: "Receptions", accessor: "receiving_receptions" },
              { Header: "Yards", accessor: "receiving_yards" },
              { Header: "Touchdowns", accessor: "receiving_touchdowns" },
            ],
          },
          {
            Header: "Rushing",
            columns: [
              { Header: "Carries", accessor: "rushing_carries" },
              { Header: "Yards", accessor: "rushing_yards" },
              { Header: "Touchdowns", accessor: "rushing_touchdowns" },
              { Header: "Fumbles Lost", accessor: "carrying_fumbles_lost" },
            ],
          },
        ];
      case "PK":
        return [
          {
            Header: "Kicking",
            columns: [
              { Header: "FG Made", accessor: "kicking_fg_made" },
              { Header: "FG Missed", accessor: "kicking_fg_missed" },
              { Header: "XP Made", accessor: "kicking_xp_made" },
              { Header: "XP Missed", accessor: "kicking_xp_missed" },
            ],
          },
        ];
      case "DST":
        return [
          {
            Header: "Defense",
            columns: [
              { Header: "Points Allowed", accessor: "dst_points_allowed" },
              { Header: "Yards Allowed", accessor: "dst_yards_allowed" },
              { Header: "Sacks", accessor: "dst_sacks" },
              { Header: "Interceptions", accessor: "dst_interceptions" },
            ],
          },
        ];
      default:
        return [];
    }
  }, []);

  // Memoize columns and filter logic
  const columns = useMemo(
    () => getPositionColumns(selectedPosition),
    [selectedPosition, getPositionColumns]
  );
  const filteredData = useMemo(() => {
    return playerStats.filter((player) => {
      const matchesPosition =
        selectedPosition === "FLX"
          ? ["RB", "WR", "TE"].includes(player.player.position)
          : player.player.position === selectedPosition;
      const matchesSeason = player.season === selectedSeason;

      return matchesPosition && matchesSeason;
    });
  }, [data, selectedPosition, searchQuery, selectedSeason]);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable(
      {
        columns: useMemo(
          () => [
            { Header: "Name", accessor: "player.name" },
            {
              Header: () => (
                <div>
                  <span>Pos </span>
                  <select
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                  >
                    <option value="QB">QB</option>
                    <option value="RB">RB</option>
                    <option value="WR">WR</option>
                    <option value="TE">TE</option>
                    <option value="PK">PK</option>
                    <option value="DST">DST</option>
                    <option value="FLX">FLX</option>
                  </select>
                </div>
              ),
              accessor: "player.position",
              id: "position-selector",
              disableSortBy: true,
            },
            { Header: "Team", accessor: "player.team.team_abv" },
            ...columns,
          ],
          [columns]
        ),
        data: filteredData,
      },
      useSortBy
    );

  return (
    <div>
      <select
        value={selectedSeason}
        onChange={(e) => setSelectedSeason(e.target.value)}
        style={{ marginLeft: "10px" }}
      >
        <option value="2023">2024</option>
        <option value="2023">2023</option>
        <option value="2022">2022</option>
        <option value="2021">2021</option>
      </select>

      <input
        type="text"
        placeholder="Search by name"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ marginLeft: "10px" }}
      />

      <table
        {...getTableProps()}
        style={{ border: "solid 1px gray" }}
        className="players-table"
      >
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()} key={headerGroup.id}>
              {headerGroup.headers.map((column) => (
                <th
                  {...column.getHeaderProps(column.getSortByToggleProps())} // Enables sorting on header click
                  key={column.id}
                >
                  {column.render("Header")}
                  {/* Add a sort direction indicator */}
                  <span>
                    {column.isSorted
                      ? column.isSortedDesc
                        ? " 🔽" // Sort descending
                        : " 🔼" // Sort ascending
                      : ""}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map((row) => {
            prepareRow(row);
            return (
              <tr {...row.getRowProps()} key={row.id}>
                {row.cells.map((cell) => (
                  <td {...cell.getCellProps()} key={cell.column.id}>
                    {cell.render("Cell")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PlayersTable;
