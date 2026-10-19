export type CountdownTone = 'green' | 'yellow' | 'red';

export function getCountdownTone(seconds: number): CountdownTone {
  if (seconds <= 60) return 'red';
  if (seconds <= 300) return 'yellow';
  return 'green';
}

export function calculateRemainingSeconds(startedAt: string, durationMinutes: number, now = Date.now()): number {
  const end = new Date(startedAt).getTime() + durationMinutes * 60_000;
  return Math.max(0, Math.ceil((end - now) / 1000));
}
