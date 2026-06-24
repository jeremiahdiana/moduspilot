let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(intervalMs: number, tick: () => void): void {
  stopScheduler();
  timer = setInterval(tick, intervalMs);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
