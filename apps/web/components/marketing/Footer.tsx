export default function Footer() {
  const links = {
    Product: [
      { label: 'Chat', href: '/features' },
      { label: 'Compare models', href: '/product/compare' },
      { label: 'Integrations', href: '/product/integrations' },
      { label: 'Desktop apps', href: '/download/mac' },
    ],
    Resources: [
      { label: 'Blog', href: '/blog' },
      { label: 'Download', href: '/download/mac' },
      { label: 'Changelog', href: '/changelog' },
    ],
    Company: [
      { label: 'About', href: '/about' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
    'Get started': [
      { label: 'Start free', href: '/login' },
      { label: 'Sign in', href: '/login' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  };

  return (
    <footer className="border-t border-border bg-panel px-6 pt-16 pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-xl font-bold tracking-widest text-text">MODUS</span>
              <span className="text-[10px] font-semibold text-muted tracking-widest uppercase">pilot</span>
            </div>
            <p className="text-sm text-muted leading-relaxed max-w-[220px]">
              Every model, and your whole life connected. One subscription.
            </p>
          </div>

          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-text uppercase tracking-widest mb-4">{group}</p>
              <ul className="space-y-2.5">
                {items.map(link => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-muted hover:text-text transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted">© 2026 Modus. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="text-xs text-muted hover:text-text transition-colors">Privacy</a>
            <a href="/terms" className="text-xs text-muted hover:text-text transition-colors">Terms</a>
            <span className="text-xs text-muted">moduspilot.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
