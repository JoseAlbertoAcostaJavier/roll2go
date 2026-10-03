/* Layout de las páginas de acceso (Login) */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-[#4a0c12]
     via-brand-dark to-brand px-4 py-10">
      {children}
    </main>
  );
}
