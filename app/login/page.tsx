"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shield, Mail, Lock, Database, CheckCircle, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unauthorizedError = searchParams.get('error') === 'unauthorized';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(unauthorizedError ? 'Please log in to access this page.' : '');


  const [dbStatus, setDbStatus] = useState<{ connected: boolean; hasUrl: boolean } | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [initMessage, setInitMessage] = useState('');

  useEffect(() => {
    checkDbStatus();
  }, []);

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/db-init');
      const data = await res.json();
      setDbStatus(data);
    } catch (err) {
      console.error('Failed to get database status', err);
    }
  };

  const handleInitDb = async () => {
    setInitLoading(true);
    setInitMessage('');
    try {
      const res = await fetch('/api/db-init', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setInitMessage('Database initialized and seeded successfully!');
        setDbStatus({ connected: true, hasUrl: true });
        setTimeout(() => checkDbStatus(), 2000);
      } else {
        setError(data.error || 'Failed to initialize database.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during database initialization.');
    } finally {
      setInitLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please try again.');
      }

      if (data.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/seller');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Incorrect credentials or database error.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="w-full max-w-md space-y-8">
        
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 dark:shadow-indigo-500/10">
            <Shield size={24} />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Inventory & Orders
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Secure sign-in for Administrators & Sellers
          </p>
        </div>

       
        {dbStatus && (!dbStatus.hasUrl || !dbStatus.connected) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400 backdrop-blur-xs">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />
              <div className="space-y-2">
                <p className="font-semibold">Database Setup Needed</p>
                {!dbStatus.hasUrl ? (
                  <p>
                    Please create a `.env.local` file in the project root and add your Neon database connection URL:
                    <br />
                    <code className="mt-1 block rounded bg-amber-100 p-1 text-xs dark:bg-amber-900/50 font-mono">
                      DATABASE_URL=postgresql://...
                    </code>
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p>Connection string detected! The database tables need to be created and seeded.</p>
                    <button
                      onClick={handleInitDb}
                      disabled={initLoading}
                      className="flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                    >
                      {initLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Initializing...
                        </>
                      ) : (
                        <>
                          <Database className="h-3.5 w-3.5" />
                          Initialize Database Tables
                        </>
                      )}
                    </button>
                  </div>
                )}
                {initMessage && (
                  <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle className="h-4 w-4" /> {initMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/70 p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-2xl/10 backdrop-blur-md">
          {error && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Email Address
              </label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-400 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-600 focus:outline-hidden"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Password
              </label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-400 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-600 focus:outline-hidden"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:from-violet-500 hover:to-indigo-500 focus:outline-hidden disabled:opacity-50 transition-all cursor-pointer hover:shadow-indigo-500/35"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Don't have an account?{' '}
              <Link
                href="/signup"
                className="font-bold text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
              >
                Sign Up
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
