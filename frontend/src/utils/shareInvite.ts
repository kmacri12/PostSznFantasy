/** The native share sheet where the browser has one; Copy stays the fallback everywhere else. */
export const canShareInvite = (): boolean => typeof navigator.share === "function";

export const shareInvite = (url: string): Promise<void> =>
  navigator
    .share({ title: "Join my league on PostSzn Fantasy", url })
    // Closing the sheet rejects with AbortError; that is not a failure.
    .catch(() => undefined);
