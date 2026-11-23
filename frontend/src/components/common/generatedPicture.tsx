import AnchorIcon from "@mui/icons-material/Anchor";
import BoltIcon from "@mui/icons-material/Bolt";
import DiamondIcon from "@mui/icons-material/Diamond";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FlagIcon from "@mui/icons-material/Flag";
import PetsIcon from "@mui/icons-material/Pets";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import ShieldIcon from "@mui/icons-material/Shield";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import StarIcon from "@mui/icons-material/Star";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import type { ElementType } from "react";

/**
 * The generated team picture's palette. The API picks an index into each list when a team is
 * created (`services/team_pictures.py`, same sizes) and gives every team of a season its own
 * colour. No red: red means eliminated here. The fills hold white icons in both themes.
 */
export const PICTURE_COLORS = [
  "#d9822b",
  "#c29b1f",
  "#8aa62b",
  "#3f9b5f",
  "#2a9d8f",
  "#2b9bb5",
  "#3d7ccf",
  "#5a63d6",
  "#8a5cc8",
  "#b556b0",
  "#d0628f",
  "#9a6b4a",
] as const;

export const PICTURE_ICONS: ElementType[] = [
  SportsFootballIcon,
  EmojiEventsIcon,
  BoltIcon,
  ShieldIcon,
  WhatshotIcon,
  StarIcon,
  RocketLaunchIcon,
  AnchorIcon,
  WorkspacePremiumIcon,
  DiamondIcon,
  PetsIcon,
  FlagIcon,
];

const at = <T,>(list: readonly T[], index: number): T =>
  list[((index % list.length) + list.length) % list.length] as T;

export const pictureColor = (index: number): string => at(PICTURE_COLORS, index);
export const pictureIcon = (index: number): ElementType => at(PICTURE_ICONS, index);
