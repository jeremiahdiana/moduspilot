import { AuthProvider } from '@/components/providers/AuthProvider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {/* overflow-x-hidden (not overflow-hidden) so a page taller than the
          viewport — the login page reveals an illustration on scroll — can
          scroll vertically while decorative art is still clipped horizontally. */}
      <main className="min-h-screen flex items-center justify-center relative overflow-x-hidden">
        {children}
      </main>
    </AuthProvider>
  );
}
