import { Alert, Button } from "@mui/material";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <Alert
    severity="error"
    action={
      onRetry && (
        <Button
          color="inherit"
          size="small"
          onClick={onRetry}
          sx={{ minHeight: 44, whiteSpace: "nowrap" }}
        >
          Try again
        </Button>
      )
    }
  >
    {message}
  </Alert>
);

export default ErrorState;
