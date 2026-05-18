export default function StreakWidget() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-1">
      <span className="text-4xl font-black text-brand">0</span>
      <span className="text-xs text-muted">day streak</span>
    </div>
  );
}
