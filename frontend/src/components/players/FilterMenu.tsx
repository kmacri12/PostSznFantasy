import { Chip, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
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
}

/** A chip that opens a short menu of choices. */
const FilterMenu = ({ label, value, options, onChange }: Props) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = options.find((option) => option.value === (value ?? ""))?.label ?? "any";
  return (
    <>
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
          color: tokens.textSoft,
          borderColor: tokens.borderStrong,
        }}
      />
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
