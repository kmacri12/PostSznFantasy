import Box from "@mui/material/Box";
import { useState } from "react";
import { useTeamLogos } from "../../api/teamLogos";

interface Props {
  abbreviation: string | null | undefined;
  size?: number;
}

/**
 * An NFL team's logo in a fixed square, so the row never shifts while it loads. The
 * abbreviation next to it stays the accessible name; without a logo (or when it fails
 * to load) the square is not rendered at all.
 */
const TeamLogo = ({ abbreviation, size = 16 }: Props) => {
  const logos = useTeamLogos();
  const [failed, setFailed] = useState<string | null>(null);
  const url = abbreviation ? logos[abbreviation] : undefined;
  if (!url || failed === url) return null;
  return (
    <Box
      component="img"
      src={url}
      alt=""
      loading="lazy"
      width={size}
      height={size}
      onError={() => setFailed(url)}
      sx={{
        width: size,
        height: size,
        objectFit: "contain",
        verticalAlign: "text-bottom",
        mr: 0.5,
      }}
    />
  );
};

export default TeamLogo;
