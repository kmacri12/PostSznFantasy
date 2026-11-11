/** The API answered 426 `app_outdated`: this tab's build is older than it still supports. */
type Listener = () => void;

let outdated = false;
const listeners = new Set<Listener>();

export const isOutdatedCode = (error: unknown): boolean => {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | null)
    ?.response;
  return response?.status === 426 && response.data?.code === "app_outdated";
};

export const signalAppOutdated = (): void => {
  outdated = true;
  for (const listener of listeners) listener();
};

export const subscribeOutdated = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const appOutdatedSnapshot = (): boolean => outdated;

export const resetAppOutdated = (): void => {
  outdated = false;
};
