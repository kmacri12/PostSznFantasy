import type { MemberSummary } from "../../api/types";

const isCommissioner = (member: MemberSummary) => member.role === "commissioner";

/** A league always keeps one commissioner, so the only one left cannot be demoted. */
export const isLastCommissioner = (members: MemberSummary[], userId: number) =>
  members.filter(isCommissioner).length === 1 &&
  members.some((member) => member.userId === userId && isCommissioner(member));

export const toggledRole = (member: MemberSummary) =>
  isCommissioner(member) ? "member" : "commissioner";

export const removalWarning = (name: string) =>
  `Remove ${name} from the league? Their team in an unfinished season is freed; finished seasons keep their name on it.`;

export const initials = (name: string) => name.trim().slice(0, 2).toUpperCase();
