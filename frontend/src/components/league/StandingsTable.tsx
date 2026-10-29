import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import axios from "axios";
import type React from "react";
import { useEffect, useState } from "react";
import { useUser } from "../../contexts/UserContext";

interface StandingsTableProps {
  leagueId: string;
}

interface Standings {
  teamName: string;
  owner: string;
  playersLeft: number;
  wildCard: number;
  divisional: number;
  confChamp: number;
  superBowl: number;
  total: number;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ leagueId }) => {
  const [standings, setStandings] = useState<Standings[]>([]);
  const [loading, setLoading] = useState(true);
  const { getIdToken } = useUser();

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const idToken = await getIdToken();

        if (!idToken) {
          console.error("No user is currently signed in.");
          return;
        }

        const response = await axios.get(`${apiUrl}/api/leagues/${leagueId}/standings`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        const sortedStandings = response.data.sort(
          (a: Standings, b: Standings) => b.total - a.total,
        );
        setStandings(sortedStandings);
      } catch (error) {
        console.error("Error fetching standings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
  }, [leagueId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
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
