/** Thrown when a server read takes too long; error boundaries offer «Дахин оролдох». */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not answer within ${ms} ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Rejects after `ms` instead of keeping a page section waiting silently on a
 * stalled database or network read. The underlying work is not cancelled.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, label = "Request") {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
