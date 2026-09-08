// Explicit symbol placement keeps server and browser ICU versions in sync.
const priceNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const formatPrice = (n: number): string => `₮${priceNumber.format(n)}`;

export const cn = (...args: (string | undefined | false | null)[]) =>
  args.filter(Boolean).join(" ");
