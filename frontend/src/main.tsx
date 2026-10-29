import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { UserProvider } from "./contexts/UserContext";
import theme from "./theme";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <UserProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </UserProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </StrictMode>,
  );
}
