/** "pat@x.co" becomes "p**@x.co": enough to recognise your own address on a shared screen. */
export const maskEmail = (address: string): string => {
  const at = address.lastIndexOf("@");
  if (at < 1) return address;
  const name = address.slice(0, at);
  return `${name[0]}${"*".repeat(Math.min(name.length - 1, 6))}${address.slice(at)}`;
};
