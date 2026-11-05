import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useThemeMode } from "../../contexts/ThemeModeContext";
import type { ThemeMode } from "../../theme";
import SettingsRow from "./SettingsRow";

const CHOICES: { value: ThemeMode; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

/** Your settings > Theme: applies at once and is remembered on this device. */
const ThemeModeRow = () => {
  const { mode, setMode } = useThemeMode();

  return (
    <SettingsRow
      label="Theme"
      trailing={
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          aria-label="Theme"
          // Tapping the selected choice would deselect it; keep exactly one on.
          onChange={(_, next: ThemeMode | null) => next && setMode(next)}
        >
          {CHOICES.map(({ value, label }) => (
            <ToggleButton key={value} value={value} sx={{ minWidth: 72, minHeight: 44 }}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      }
    />
  );
};

export default ThemeModeRow;
