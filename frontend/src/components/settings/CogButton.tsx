import SettingsIcon from "@mui/icons-material/Settings";
import { IconButton } from "@mui/material";
import { Link } from "react-router-dom";

type Props = { label: string } & (
  | { to: string; onClick?: never }
  | { onClick: () => void; to?: never }
);

/** The cog that opens a page's settings: a link to the page, or a button that opens a sheet. */
const CogButton = ({ label, to, onClick }: Props) => (
  <IconButton
    aria-label={label}
    {...(to ? { component: Link, to } : { onClick })}
    sx={{ color: "text.secondary" }}
  >
    <SettingsIcon />
  </IconButton>
);

export default CogButton;
