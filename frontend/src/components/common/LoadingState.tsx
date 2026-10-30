import { Box, Skeleton } from "@mui/material";

interface LoadingStateProps {
  /** What is loading, announced to screen readers ("Loading standings"). */
  what: string;
  rows?: number;
}

const LoadingState = ({ what, rows = 4 }: LoadingStateProps) => (
  <Box role="status" aria-label={`Loading ${what}`} sx={{ display: "grid", gap: 1 }}>
    {Array.from({ length: rows }, (_, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
      <Skeleton key={index} variant="rounded" height={56} />
    ))}
  </Box>
);

export default LoadingState;
