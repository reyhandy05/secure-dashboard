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
      className="w-full rounded bg-emerald-500 py-2.5 font-medium text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
    >
      {pending ? "Signing in..." : "Continue"}
    </button>
  );
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function clientAction(formData: FormData) {
    setError(null);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const res = await loginAction({ email, password });
    if (res?.error) {
      setError(res.error);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">NORTHSTAR</p>
            <h1 className="text-sm font-medium text-slate-300">Security Console</h1>
          </div>
        </div>

        <h2 className="text-2xl font-bold">Sign in securely</h2>
        <p className="mt-1 text-sm text-slate-400">Use your organization credentials to continue.</p>

        {error && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form action={clientAction} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              name="email"
              required
              className="mt-1 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              name="password"
              required
              className="mt-1 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Access is monitored and recorded. <span className="text-emerald-400">System status</span>
        </p>
      </div>
    </div>
  );
}