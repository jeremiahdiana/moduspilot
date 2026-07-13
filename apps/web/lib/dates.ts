/**
 * The user's LOCAL calendar date as `YYYY-MM-DD`.
 *
 * Habit completions and task due dates are stored as plain local calendar dates
 * — what a person actually means by "today" — so every per-day comparison
 * against them must also be computed in local time.
 *
 * Using `new Date().toISOString().slice(0, 10)` for this is a bug: it returns
 * the *UTC* date, which is a full day ahead for much of the Americas every
 * evening. That mismatch silently reset habit streaks, hid "due today" tasks,
 * and highlighted the wrong day on the habit heatmap.
 */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
