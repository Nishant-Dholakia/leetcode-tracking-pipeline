export function isWithinLookbackWindow(
  solvedAtUnixSeconds: number,
  lookbackHours: number,
  now = new Date()
): boolean {
  const solvedAtMs = solvedAtUnixSeconds * 1000;
  const cutoff = now.getTime() - lookbackHours * 60 * 60 * 1000;
  return solvedAtMs >= cutoff && solvedAtMs <= now.getTime();
}

export function toIsoFromUnixSeconds(value: number): string {
  return new Date(value * 1000).toISOString();
}
