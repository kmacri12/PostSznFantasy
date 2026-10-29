import { Box, Button, Typography } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { createLogger } from "../utils/logger";

const logger = createLogger("ErrorBoundary");

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("Uncaught render error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <Typography variant="h5" gutterBottom>
          Something went wrong
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </Box>
    );
  }
}
