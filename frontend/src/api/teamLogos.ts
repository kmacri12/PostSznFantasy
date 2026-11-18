import { useEffect, useSyncExternalStore } from "react";
import { api } from "./client";

type Logos = Record<string, string>;

let logos: Logos = {};
let requested = false;
const listeners = new Set<() => void>();

const load = () => {
  if (requested) return;
  requested = true;
  api
    .get<Logos>("/api/players/team-logos")
    .then((response) => {
      logos = response.data;
      for (const listener of listeners) listener();
    })
    // Rows fall back to the abbreviation, so a miss only costs the pictures until the next visit.
    .catch(() => {
      requested = false;
    });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** NFL team abbreviation to logo URL, fetched once per page load (not a React Query key, so rows render without a provider). */
export const useTeamLogos = (): Logos => {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, () => logos);
};

export const resetTeamLogosForTests = () => {
  logos = {};
  requested = false;
};
