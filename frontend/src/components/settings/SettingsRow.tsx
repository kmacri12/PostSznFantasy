import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, ButtonBase, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value?: ReactNode;
  /** Makes the whole row a button with a chevron. */
  onClick?: () => void;
  danger?: boolean;
  centered?: boolean;
  /** Replaces the value and chevron, e.g. a switch. */
  trailing?: ReactNode;
}

/** One 52px-plus row: bold label on the left, muted value (ellipsized) and chevron on the right. */
const SettingsRow = ({
  label,
  value,
  onClick,
  danger = false,
  centered = false,
  trailing,
}: Props) => {
  const body = (
    <>
      <Typography
        component="span"
        sx={{ fontWeight: 600, flexShrink: 0, color: danger ? "error.light" : "text.primary" }}
      >
        {label}
      </Typography>
      {trailing ?? (
        <>
          {value !== undefined && (
            <Typography
              component="span"
              color="text.secondary"
              variant="body2"
              noWrap
              sx={{ minWidth: 0, flex: 1, textAlign: "right" }}
            >
              {value}
            </Typography>
          )}
          {onClick && !centered && <ChevronRightIcon fontSize="small" color="disabled" />}
        </>
      )}
    </>
  );
  const sx = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    width: "100%",
    minHeight: 52,
    px: 2,
    justifyContent: centered ? "center" : "space-between",
    textAlign: "left",
  } as const;

  return onClick ? (
    <ButtonBase onClick={onClick} sx={sx}>
      {body}
    </ButtonBase>
  ) : (
    <Box sx={sx}>{body}</Box>
  );
};

export default SettingsRow;
