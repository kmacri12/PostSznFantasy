import { Container } from "@mui/material";
import type { ReactNode } from "react";
import { leagueDeletedInfo } from "../../api/leagueDeleted";
import LeagueDeletedNotice from "../league/LeagueDeletedNotice";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import { friendlyError } from "./friendlyError";
import LoadingState from "./LoadingState";

interface QueryLike<T> {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  refetch: () => unknown;
}

interface QueryBoundaryProps<T> {
  query: QueryLike<T>;
  /** Plural noun for messages: "standings" -> "Loading standings" / "Reload standings". */
  what: string;
  isEmpty?: (data: T) => boolean;
  empty?: { title: string; description?: string; action?: ReactNode };
  skeleton?: ReactNode;
  /** Centre the loading, error and empty states in a page-width container (for whole-page queries). */
  page?: boolean;
  children: (data: T) => ReactNode;
}

/** Renders the loading, error (with retry) and empty states of a query, then its content. */
const QueryBoundary = <T,>({
  query,
  what,
  isEmpty,
  empty,
  skeleton,
  page,
  children,
}: QueryBoundaryProps<T>) => {
  const frame = (node: ReactNode) =>
    page ? (
      <Container maxWidth="md" sx={{ py: 4 }}>
        {node}
      </Container>
    ) : (
      node
    );
  if (query.isLoading) return frame(skeleton ?? <LoadingState what={what} />);
  const deleted = leagueDeletedInfo(query.error);
  if (deleted) return frame(<LeagueDeletedNotice {...deleted} />);
  if (query.isError || query.data === undefined) {
    return frame(
      <ErrorState
        message={friendlyError(
          query.error,
          `Couldn't load ${what}. Check your connection and try again.`,
        )}
        onRetry={() => query.refetch()}
      />,
    );
  }
  if (isEmpty?.(query.data) && empty) return frame(<EmptyState {...empty} />);
  return <>{children(query.data)}</>;
};

export default QueryBoundary;
