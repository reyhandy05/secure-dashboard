import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { loginAction } from "@/app/actions";
import SubmitButton from "./submit-button";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"><ShieldCheck size={19} /></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-emerald-400">Northstar</p><p className="text-sm font-semibold text-white">Security Console</p></div></div>
        <h1 className="text-2xl font-semibold tracking-[-.03em] text-white">Sign in securely</h1>
        <p className="mt-2 text-sm text-slate-400">Use your organization credentials to continue.</p>
        <form className="mt-7 space-y-4" action={loginAction}>
          <label className="block text-xs font-semibold text-slate-400">Email<input className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" type="email" name="email" autoComplete="username" maxLength={254} required /></label>
          <label className="block text-xs font-semibold text-slate-400">Password<input className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" type="password" name="password" autoComplete="current-password" minLength={8} maxLength={128} required /></label>
          <SubmitButton />
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">Access is monitored and recorded. <Link href="/" className="font-semibold text-emerald-400 hover:text-emerald-300">System status</Link></p>
      </section>
    </main>
  );
}
