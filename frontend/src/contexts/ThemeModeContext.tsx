import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { createAppTheme, modeVariables, type ThemeMode } from "../theme";
import { applyThemeMode, readStoredThemeMode, storeThemeMode } from "../utils/themeMode";

interface ThemeModeValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeValue>({ mode: "dark", setMode: () => {} });

export const useThemeMode = () => useContext(ThemeModeContext);

/** The one place the mode lives: it drives the MUI theme, the CSS variables and the stored choice; the theme also follows reduced motion. */
export const ThemeModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(readStoredThemeMode);
  const setMode = useCallback((next: ThemeMode) => {
    applyThemeMode(next);
    storeThemeMode(next);
    setModeState(next);
  }, []);
  const reducedMotion = useReducedMotion();
  const theme = useMemo(() => createAppTheme(mode, reducedMotion), [mode, reducedMotion]);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <GlobalStyles styles={modeVariables} />
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};
