import { Chip, IconButton, Menu, MenuItem } from "@mui/material";
import { type ReactNode, useState } from "react";
import { tokens } from "../../theme";

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  /** Chip text before the choice, such as "NFL team". */
  label: string;
  /** The chosen option's value; null selects the option with the empty value ("any"). */
  value: string | null;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Caps the chip's width so a long choice ends in an ellipsis instead of wrapping the row. */
  maxWidth?: number;
  /** Shows an outlined icon button instead of a chip; its name says the label and the choice. */
  icon?: ReactNode;
}

/** A chip that opens a short menu of choices. */
const FilterMenu = ({ label, value, options, onChange, maxWidth, icon }: Props) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = options.find((option) => option.value === (value ?? ""))?.label ?? "any";
  return (
    <>
      {icon ? (
        <IconButton
          aria-label={`${label}: ${current}`}
          aria-haspopup="menu"
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 1,
            border: `1px solid ${tokens.borderStrong}`,
            color: tokens.textSoft,
          }}
        >
          {icon}
        </IconButton>
      ) : (
        <Chip
          clickable
          variant="outlined"
          label={
            <>
              {label}: {current}
              <span aria-hidden="true"> ▾</span>
            </>
          }
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-haspopup="menu"
          sx={{
            height: 36,
            minHeight: 36,
            maxWidth,
            minWidth: 0,
            fontSize: 13,
            "& .MuiChip-label": { px: 1.25 },
            color: tokens.textSoft,
            borderColor: tokens.borderStrong,
          }}
        />
      )}
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === (value ?? "")}
            sx={{ minHeight: 44 }}
            onClick={() => {
              onChange(option.value);
              setAnchor(null);
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default FilterMenu;
