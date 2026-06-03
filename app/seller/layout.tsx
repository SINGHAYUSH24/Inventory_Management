import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user || user.role !== 'seller') {
    redirect('/login?error=unauthorized');
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-50">
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              IMS Seller
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              Workspace
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right sm:block hidden">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
