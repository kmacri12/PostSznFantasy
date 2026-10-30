import type { ReactNode } from "react";
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
  children: (data: T) => ReactNode;
}

/** Renders the loading, error (with retry) and empty states of a query, then its content. */
const QueryBoundary = <T,>({
  query,
  what,
  isEmpty,
  empty,
  skeleton,
  children,
}: QueryBoundaryProps<T>) => {
  if (query.isLoading) return <>{skeleton ?? <LoadingState what={what} />}</>;
  if (query.isError || query.data === undefined) {
    return (
      <ErrorState
        message={friendlyError(query.error, `Reload ${what} to try again.`)}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (isEmpty?.(query.data) && empty) return <EmptyState {...empty} />;
  return <>{children(query.data)}</>;
};

export default QueryBoundary;
