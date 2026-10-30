import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { IconButton, Tooltip } from "@mui/material";

interface Props {
  /** What the control is about, for screen readers: "About Team QB". */
  label: string;
  text: string;
}

/** An info button whose explanation opens on a tap, a hover or keyboard focus. */
const HelpTip = ({ label, text }: Props) => (
  <Tooltip title={text} arrow enterTouchDelay={0} leaveTouchDelay={8000}>
    <IconButton aria-label={`About ${label}`} sx={{ width: 44, height: 44 }}>
      <InfoOutlinedIcon fontSize="small" />
    </IconButton>
  </Tooltip>
);

export default HelpTip;
