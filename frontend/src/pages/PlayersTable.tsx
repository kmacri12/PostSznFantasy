import React, { useCallback, useMemo, useState } from 'react';
import { useTable } from 'react-table';


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



const PlayersTable = ({ data }) => {
    const getPositionColumns = useCallback((position: string) => {
        switch (position) {
          case 'QB':
            return [
              { Header: 'Passing Completions', accessor: 'passing_completions' },
              { Header: 'Passing Attempts', accessor: 'passing_attempts' },
              { Header: 'Passing Yards', accessor: 'passing_yards' },
              { Header: 'Carrying Fumbles', accessor: 'carrying_fumbles' },
              { Header: 'Rushing Carries', accessor: 'rushing_carries' },
              { Header: 'Rushing Yards', accessor: 'rushing_yards' },
            ];
          case 'RB':
          case 'WR':
          case 'TE':
            return [
              { Header: 'Receiving Receptions', accessor: 'receiving_receptions' },
              { Header: 'Receiving Yards', accessor: 'receiving_yards' },
              { Header: 'Rushing Carries', accessor: 'rushing_carries' },
              { Header: 'Rushing Yards', accessor: 'rushing_yards' },
              { Header: 'Carrying Fumbles', accessor: 'carrying_fumbles' },
            ];
          case 'PK':
            return [
              { Header: 'Kicking FG Made', accessor: 'kicking_fg_made' },
              { Header: 'Kicking FG Missed', accessor: 'kicking_fg_missed' },
              { Header: 'Kicking XP Made', accessor: 'kicking_xp_made' },
              { Header: 'Kicking XP Missed', accessor: 'kicking_xp_missed' },
            ];
          case 'DST':
            return [
              { Header: 'DST Points Allowed', accessor: 'dst_points_allowed' },
              { Header: 'DST Yards Allowed', accessor: 'dst_yards_allowed' },
              { Header: 'DST Sacks', accessor: 'dst_sacks' },
              { Header: 'DST Interceptions', accessor: 'dst_interceptions' },
            ];
          default:
            return [];
        }
      }, []);    
  const [selectedPosition, setSelectedPosition] = useState('QB');
  const columns = useMemo(() => getPositionColumns(selectedPosition), [selectedPosition, getPositionColumns]);
  const filteredData = useMemo(() => {
    return data.filter((player) => player.player.position === selectedPosition);
  }, [data, selectedPosition]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({
    columns: useMemo(() => [
        { Header: 'Name', accessor: 'player.name' },
        ...columns,
      ], [columns]),
    data: filteredData,
  });

  return (
    <div>
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
      </select>
      <table {...getTableProps()} style={{ border: 'solid 1px gray' }}>
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()} key={headerGroup.id}>
              {headerGroup.headers.map((column) => (
                <th {...column.getHeaderProps()} key={column.id}>
                  {column.render('Header')}
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
                    {cell.render('Cell')}
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