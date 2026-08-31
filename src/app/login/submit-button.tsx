"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-[#00d084] py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Signing in..." : "Continue"}
    </button>
  );
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function handleFormSubmit(formData: FormData) {
    setError(null);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const res = await loginAction({ email, password });
    if (res?.error) {
      setError(res.error);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b14] px-4 font-sans text-slate-100">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-800/80 bg-[#0d1321] p-8 shadow-2xl">
        {/* Header Logo */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-[#00d084]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-[#00d084] uppercase">NORTHSTAR</p>
            <h1 className="text-sm font-medium text-slate-300">Security Console</h1>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white">Sign in securely</h2>
        <p className="mt-1 text-sm text-slate-400">Use your organization credentials to continue.</p>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form action={handleFormSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="name@organization.com"
              className="mt-1.5 w-full rounded-md border border-slate-800 bg-[#070b14] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-[#00d084] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-md border border-slate-800 bg-[#070b14] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-[#00d084] focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>

        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-slate-500">
          Access is monitored and recorded. <span className="cursor-pointer text-[#00d084] hover:underline">System status</span>
        </p>
      </div>
    </main>
  );
}