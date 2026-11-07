import { Avatar } from "@mui/material";
import { tokens } from "../../theme";
import { avatarSrc, initialsOf } from "../../utils/avatarUrl";
import Logo from "./Logo";

interface Props {
  /** The `avatarUrl` the API returned, or empty for the fallback. */
  url?: string | null;
  /** Who or what it is: the initials come from it. */
  name: string;
  size?: number;
  /** A league without a picture shows the bracket tile instead of initials. */
  fallback?: "initials" | "tile";
}

/** A member, team or league picture; initials (or the bracket tile) until one is set. */
const PictureAvatar = ({ url, name, size = 32, fallback = "initials" }: Props) => {
  const src = avatarSrc(url);
  if (!src && fallback === "tile") {
    return (
      <span aria-hidden style={{ display: "inline-flex", flex: "none" }}>
        <Logo variant="mark" tile size={size} />
      </span>
    );
  }
  return (
    <Avatar
      src={src}
      alt=""
      sx={{
        width: size,
        height: size,
        flex: "none",
        bgcolor: tokens.border,
        color: tokens.text,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        fontWeight: 600,
      }}
    >
      {initialsOf(name)}
    </Avatar>
  );
};

export default PictureAvatar;
