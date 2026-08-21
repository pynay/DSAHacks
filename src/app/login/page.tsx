'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, PackageOpen } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('operator@parsel.app');
  const [password, setPassword] = useState('parsel');

  // Demo build: no real auth. Any submit "passes" straight into the console.
  function enter(e: React.FormEvent) {
    e.preventDefault();
    router.push('/dashboard');
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#071a2b] px-5 text-white">
      <div className="pointer-events-none absolute right-[-10rem] top-[-10rem] h-[36rem] w-[36rem] rounded-full bg-[#54b889]/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-12rem] left-[-8rem] h-[32rem] w-[32rem] rounded-full bg-[#3ca875]/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link href="/" aria-label="Parsel home" className="mb-8 inline-flex items-center gap-2.5">
          <PackageOpen size={26} className="text-[#54b889]" />
          <span className="text-xl font-semibold tracking-tight">Parsel</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#0b2538] p-8 shadow-2xl shadow-black/30">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to the console</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Welcome back. Pick up where the operation left off.
          </p>

          <form onSubmit={enter} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-white/10 bg-[#071a2b] px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-[#54b889] focus:ring-2 focus:ring-[#54b889]/30"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-white/10 bg-[#071a2b] px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-[#54b889] focus:ring-2 focus:ring-[#54b889]/30"
              />
            </label>

            <button
              type="submit"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#3ca875] px-4 py-2.5 text-sm font-semibold text-[#071a2b] transition hover:bg-[#54b889]"
            >
              Sign in <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            Demo build — no credentials needed, any sign-in opens the console.
          </p>
        </div>

        <div className="mt-6 text-center text-sm text-slate-400">
          <Link href="/" className="transition hover:text-white">
            &larr; Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
