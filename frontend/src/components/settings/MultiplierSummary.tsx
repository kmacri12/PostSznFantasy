import { Box, Typography } from "@mui/material";
import { POSTSEASON_FIELDS, type PostseasonValues } from "../../settings/postseasonFields";
import { visuallyHidden } from "../common/visuallyHidden";

const ROUND_ABBREVIATIONS: Record<string, string> = {
  multiplier_wild_card: "WC",
  multiplier_divisional: "DIV",
  multiplier_conference: "CONF",
  multiplier_super_bowl: "SB",
};

/** The four round multipliers as a small table: abbreviations over values, full names for screen readers. */
const MultiplierSummary = ({ values }: { values: PostseasonValues }) => (
  <Box
    component="table"
    sx={{
      borderCollapse: "collapse",
      mt: 0.25,
      "& th, & td": { width: 52, p: 0, textAlign: "left" },
    }}
  >
    <thead>
      <tr>
        {POSTSEASON_FIELDS.filter((field) => field.key in ROUND_ABBREVIATIONS).map((field) => (
          <Box component="th" key={field.key} scope="col" sx={{ fontWeight: 500 }}>
            <Typography variant="caption" color="text.secondary" aria-hidden>
              {ROUND_ABBREVIATIONS[field.key]}
            </Typography>
            <Box component="span" sx={visuallyHidden}>
              {field.label.replace(/ multiplier$/, "")}
            </Box>
          </Box>
        ))}
      </tr>
    </thead>
    <tbody>
      <tr>
        {POSTSEASON_FIELDS.filter((field) => field.key in ROUND_ABBREVIATIONS).map((field) => (
          <Box component="td" key={field.key}>
            <Typography variant="body2">{String(values[field.key])}x</Typography>
          </Box>
        ))}
      </tr>
    </tbody>
  </Box>
);

export default MultiplierSummary;
