/** Build time of this bundle in epoch seconds; 0 in the dev server (no /version.json there). */
export const BUILD_TIME: number = __BUILD_TIME__;

/** What `public/_headers`' no-cache `/version.json` says the deployed build is. */
export const parseBuiltAt = (body: unknown): number | null => {
  const builtAt = (body as { builtAt?: unknown } | null)?.builtAt;
  return typeof builtAt === "number" && Number.isFinite(builtAt) ? builtAt : null;
};

export const isNewerBuild = (deployed: number | null, own: number = BUILD_TIME): boolean =>
  deployed !== null && deployed > own;

/** The deployed build's time, or null when it can't be read (offline, dev server, bad body). */
export const fetchDeployedBuild = async (): Promise<number | null> => {
  try {
    const response = await fetch("/version.json", { cache: "no-store" });
    if (!response.ok) return null;
    return parseBuiltAt(await response.json());
  } catch {
    return null;
  }
};

/**
 * The update prompt never interrupts a draft or a field being typed in; it waits and appears
 * once the member leaves the draft or the field loses focus.
 */
export const updatePromptAllowed = (pathname: string, active: Element | null): boolean => {
  if (/(^|\/)draft(\/|$)/.test(pathname)) return false;
  if (!active) return true;
  const tag = active.tagName;
  const editable = (active as HTMLElement).isContentEditable === true;
  return !(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable);
};
