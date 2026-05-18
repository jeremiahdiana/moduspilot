export default function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <span className="text-xl font-black tracking-widest text-brand">MODUS</span>
          <div className="flex items-center gap-8">
            {[
              { label: 'Features', href: '#features' },
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'App', href: '/login' },
            ].map(link => (
              <a key={link.label} href={link.href} className="text-sm text-muted hover:text-text transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <span className="text-sm text-muted">moduspilot.com</span>
        </div>
        <div className="border-t border-border/50 pt-6 text-center">
          <p className="text-xs text-muted/60">© 2026 MODUS Pilot · moduspilot.com</p>
        </div>
      </div>
    </footer>
  );
}
