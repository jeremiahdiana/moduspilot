type Status = 'live' | 'beta' | 'soon';

const STYLES: Record<Status, string> = {
  live: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  beta: 'bg-brand/10 text-brand border-brand/20',
  soon: 'bg-muted/10 text-muted border-border',
};

const LABELS: Record<Status, string> = { live: 'Live', beta: 'Beta', soon: 'Soon' };

/**
 * StatusBadge — the Live / Beta / Soon pill used on platform + integration
 * surfaces (marketing PlatformsSection, capabilities, connectors).
 */
export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STYLES[status]}`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
      {label ?? LABELS[status]}
    </span>
  );
}
