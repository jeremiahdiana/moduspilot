export default function Footer() {
  const links = {
    Product: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'Download for Mac', href: '/download/mac' },
    ],
    Company: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
    'Get Started': [
      { label: 'Sign Up Free', href: '/login' },
      { label: 'Sign In', href: '/login' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  };

  return (
    <footer className="relative bg-panel px-6 pt-16 pb-10 overflow-hidden">
      <div className="max-w-6xl mx-auto relative">
        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-2xl font-black tracking-widest text-brand">MODUS</span>
              <span className="text-[10px] font-semibold text-muted tracking-widest uppercase">pilot</span>
            </div>
            <p className="text-sm text-muted leading-relaxed max-w-[200px]">
              The only AI you&apos;ll ever need, so you can focus on what matters.
            </p>
          </div>

          {/* Link cols */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-bold text-text uppercase tracking-widest mb-4">{group}</p>
              <ul className="space-y-2.5">
                {items.map(link => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-muted hover:text-brand transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted/50">© 2026 Modus · All rights reserved</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="text-xs text-muted/50 hover:text-muted transition-colors">Privacy</a>
            <a href="/terms" className="text-xs text-muted/50 hover:text-muted transition-colors">Terms</a>
            <span className="text-xs text-muted/30">moduspilot.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
