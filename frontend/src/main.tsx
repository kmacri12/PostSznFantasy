import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, ScrollRestoration } from "react-router-dom";
import App from "./App.tsx";
import "./assets/fonts.css";
import { recheckLeagueOnDeleted } from "./api/leagueDeleted";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeModeProvider } from "./contexts/ThemeModeContext";
import { UserProvider } from "./contexts/UserContext";
import { registerServiceWorker } from "./utils/pushSetup";
import { scrollKey } from "./utils/scrollKey";
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

// A data router, because the settings page blocks navigation while it has unsaved edits.
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <>
        <ScrollRestoration getKey={scrollKey} />
        <UserProvider>
          <App />
        </UserProvider>
      </>
    ),
  },
]);

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <ThemeModeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeModeProvider>
    </StrictMode>,
  );
}
