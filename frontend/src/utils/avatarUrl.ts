/** The API serves pictures at a path it returns; this adds the API origin the SPA was built for. */
export const avatarSrc = (path: string | null | undefined): string | undefined =>
  path ? `${import.meta.env.VITE_API_URL ?? ""}${path}` : undefined;

/** Up to two initials of a name, address or label. */
export const initialsOf = (name: string): string =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "?";
