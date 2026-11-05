import { CssBaseline, ThemeProvider } from "@mui/material";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { recheckLeagueOnDeleted } from "./api/leagueDeleted";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { UserProvider } from "./contexts/UserContext";
import theme from "./theme";
import { registerServiceWorker } from "./utils/pushSetup";
import { initSentry } from "./utils/sentry";

initSentry();
registerServiceWorker();

const queryClient: QueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  queryCache: new QueryCache({
    onError: (error, query) => recheckLeagueOnDeleted(queryClient, error, query.queryKey),
  }),
  mutationCache: new MutationCache({
    onError: (error) => recheckLeagueOnDeleted(queryClient, error),
  }),
});

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <UserProvider>
                <App />
              </UserProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </StrictMode>,
  );
}
