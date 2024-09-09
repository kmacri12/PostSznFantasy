import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";

interface StandingsTableProps {
  leagueId: string;
}

interface Team {
  id: number;
  name: string;
  ownerId: number;
  // Add other necessary fields
}

interface Standings {
  rank: number;
  teamName: string;
  owner: string;
  playersLeft: number; // Placeholder type
  wildCard: number; // Placeholder type
  divisional: number; // Placeholder type
  confChamp: number; // Placeholder type
  superBowl: number; // Placeholder type
  total: number; // Placeholder type
}

const StandingsTable: React.FC<StandingsTableProps> = ({ leagueId }) => {
  const [standings, setStandings] = useState<Standings[]>([]);

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const response = await axios.get(`/api/league/${leagueId}/standings`);
        setStandings(response.data);
      } catch (error) {
        console.error("Error fetching standings:", error);
      }
    };

    fetchStandings();
  }, [leagueId]);

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Rank</TableCell>
            <TableCell>Team Name</TableCell>
            <TableCell>Owner</TableCell>
            <TableCell>Players Left</TableCell>
            <TableCell>Wild Card</TableCell>
            <TableCell>Divisional</TableCell>
            <TableCell>Conf Champ</TableCell>
            <TableCell>Super Bowl</TableCell>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {standings.map((row) => (
            <TableRow key={row.teamName}>
              <TableCell>{row.rank}</TableCell>
              <TableCell>{row.teamName}</TableCell>
              <TableCell>{row.owner}</TableCell>
              <TableCell>{row.playersLeft}</TableCell>
              <TableCell>{row.wildCard}</TableCell>
              <TableCell>{row.divisional}</TableCell>
              <TableCell>{row.confChamp}</TableCell>
              <TableCell>{row.superBowl}</TableCell>
              <TableCell>{row.total}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default StandingsTable;
