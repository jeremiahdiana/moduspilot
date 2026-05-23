import { AuthProvider } from '@/components/providers/AuthProvider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <main className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {children}
      </main>
    </AuthProvider>
  );
}
