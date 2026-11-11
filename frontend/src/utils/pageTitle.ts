const BRAND = "PostSzn Fantasy";

const SECTIONS: [RegExp, string][] = [
  [/^\/draft\/board$/, "Draft board"],
  [/^\/draft$/, "Draft"],
  [/^\/feed$/, "Feed"],
  [/^\/more$/, "More"],
  [/^\/how-to-play$/, "How to play"],
  [/^\/settings$/, "League settings"],
  [/^\/teams\/\d+$/, "Team"],
  [/^$/, "Standings"],
];

const STATIC: Record<string, string> = {
  "/how-to-play": "How to play",
  "/privacy": "Privacy",
  "/terms": "Terms",
  "/sign-in": "Sign in",
  "/create-league": "Create a league",
};

/** "Standings · League name · PostSzn Fantasy" for tabs, history and screen readers. */
export const pageTitle = (pathname: string, leagueName?: string): string => {
  const fixed = STATIC[pathname];
  if (fixed) return `${fixed} · ${BRAND}`;
  if (pathname.startsWith("/join/")) return `Join a league · ${BRAND}`;
  const inLeague = /^\/leagues\/\d+(?:\/seasons\/\d+)?(\/.*)?$/.exec(pathname);
  if (inLeague) {
    const section = SECTIONS.find(([pattern]) => pattern.test(inLeague[1] ?? ""))?.[1];
    return [section, leagueName, BRAND].filter(Boolean).join(" · ");
  }
  return BRAND;
};
