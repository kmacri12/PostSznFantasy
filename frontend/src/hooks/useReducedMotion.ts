import { useMediaQuery } from "@mui/material";
import { E2E_BUILD } from "../utils/e2e";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * True when the device asks for reduced motion (WCAG 2.3.3), and always in the e2e build, whose
 * specs cannot tell a mid-animation element from a settled one. The theme turns every MUI
 * transition and CSS animation off while it holds; new motion (confetti, slide-ins) checks it too.
 */
export const useReducedMotion = (): boolean =>
  useMediaQuery(REDUCED_MOTION_QUERY, { noSsr: true }) || E2E_BUILD;

/** The same answer outside React, for imperative calls such as `scrollTo({ behavior })`. */
export const prefersReducedMotion = (): boolean =>
  E2E_BUILD ||
  (typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches);
