import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import { useState } from "react";
import { tokens } from "../../theme";
import { visuallyHidden } from "../common/visuallyHidden";
import {
  isoDate,
  longDate,
  monthCells,
  monthTitle,
  parseMonth,
  shiftMonth,
  weekdayInitials,
} from "./calendarMonth";

interface Props {
  /** The chosen day as `YYYY-MM-DD`, or "" for none. */
  value: string;
  /** The first day that can be chosen; earlier days are greyed out. */
  min: string;
  onChange: (day: string) => void;
}

/** A Sunday-first month grid, so the weekday is always in view. */
const DraftCalendar = ({ value, min, onChange }: Props) => {
  const [shown, setShown] = useState(parseMonth(value || min));
  const cells = monthCells(shown.year, shown.month);
  const atEarliestMonth = isoDate(shown.year, shown.month, 1) <= `${min.slice(0, 8)}01`;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <IconButton
          aria-label="Previous month"
          disabled={atEarliestMonth}
          onClick={() => setShown(shiftMonth(shown, -1))}
          sx={{ width: 44, height: 44 }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography component="h3" aria-live="polite" sx={{ fontWeight: 700 }}>
          {monthTitle(shown.year, shown.month)}
        </Typography>
        <IconButton
          aria-label="Next month"
          onClick={() => setShown(shiftMonth(shown, 1))}
          sx={{ width: 44, height: 44 }}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: "2px" }}>
        {weekdayInitials().map((initial, index) => (
          <Typography
            // The seven initials repeat (T, S), so the column is the key.
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed seven columns
            key={index}
            aria-hidden
            variant="caption"
            sx={{ textAlign: "center", color: tokens.muted, fontWeight: 600, pb: 0.5 }}
          >
            {initial}
          </Typography>
        ))}
        {cells.map((day, index) => {
          if (day === null) {
            // biome-ignore lint/suspicious/noArrayIndexKey: padding cells have no identity
            return <Box key={`pad-${index}`} />;
          }
          const iso = isoDate(shown.year, shown.month, day);
          const selected = iso === value;
          const past = iso < min;
          return (
            <ButtonBase
              key={iso}
              disabled={past}
              aria-pressed={selected}
              onClick={() => onChange(iso)}
              sx={{
                height: 44,
                borderRadius: "50%",
                fontSize: "0.95rem",
                fontWeight: selected ? 700 : 400,
                color: selected ? tokens.accentInk : past ? tokens.muted : tokens.text,
                opacity: past ? 0.45 : 1,
                bgcolor: selected ? tokens.accentFill : "transparent",
                border: iso === min && !selected ? `1px solid ${tokens.accentBorder}` : "none",
                "&:hover": { bgcolor: selected ? tokens.accentFill : tokens.accentSurface },
              }}
            >
              {day}
              <Box component="span" sx={visuallyHidden}>{` ${longDate(iso)}`}</Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
};

export default DraftCalendar;
