// Explicit symbol placement keeps server and browser ICU versions in sync.
const priceNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const formatPrice = (n: number): string => `₮${priceNumber.format(n)}`;

const dateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Ulaanbaatar",
});

export const formatDateTime = (value: string | Date): string => {
  const parts = Object.fromEntries(
    dateTimeFormatter
      .formatToParts(value instanceof Date ? value : new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
};

export const cn = (...args: (string | undefined | false | null)[]) =>
  args.filter(Boolean).join(" ");
