// Apps that open links in their own web view. Google refuses OAuth there ("disallowed_useragent"),
// while the emailed code works anywhere because nothing has to redirect back.
const IN_APP_BROWSER =
  /Instagram|FBAN|FBAV|FB_IAB|Snapchat|musical_ly|BytedanceWebview|Line\/|; wv\)/i;

export const isInAppBrowser = (userAgent: string = navigator.userAgent): boolean =>
  IN_APP_BROWSER.test(userAgent);
