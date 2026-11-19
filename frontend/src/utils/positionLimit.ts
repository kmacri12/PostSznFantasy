/** The API stores "no limit" as this cap (ROSTER_MAX_CAP in api/models/league_models.py). */
export const NO_LIMIT = 99;

export const NO_LIMIT_LABEL = "No limit";

export const isNoLimit = (cap: number | string | undefined): boolean => Number(cap) >= NO_LIMIT;

/** A position cap as people read it: the number, or "No limit" for the stored 99. */
export const formatLimit = (cap: number | string): string =>
  isNoLimit(cap) ? NO_LIMIT_LABEL : String(cap);

/** What a limit field shows: empty (with the "No limit" placeholder) for the stored 99. */
export const limitFieldValue = (cap: number | string | undefined): number | string =>
  cap === undefined || isNoLimit(cap) ? "" : cap;

/** What a limit field saves: an emptied field is no limit. */
export const limitFromField = (raw: string): string => (raw.trim() === "" ? String(NO_LIMIT) : raw);
