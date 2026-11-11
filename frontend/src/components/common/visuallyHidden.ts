/** Off screen but still read by screen readers: spoken labels and live announcements. */
export const visuallyHidden = {
  position: "absolute",
  // Strings: in MUI `sx` a bare 1 means 100%, not one pixel.
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;
