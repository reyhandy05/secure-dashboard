"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { activateInvitedMember } from "@/app/actions/auth";

function ActivateForm() {
  const searchParams = useSearchParams(); const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null); const [isPending, setIsPending] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setIsPending(true);
    try { const result = await activateInvitedMember(token); if (result?.error) { setError(result.error); return; } router.push("/login"); }
    catch { setError("Aktivasi akun tidak dapat diproses."); }
    finally { setIsPending(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#070d12] p-6 text-slate-100"><form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl"><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-emerald-400">Northstar / Activation</p><h1 className="mt-3 text-2xl font-bold text-white">Aktivasi akun member</h1><p className="mt-2 text-sm text-slate-400">Konfirmasi aktivasi untuk menerima kode masuk aman melalui email.</p>{error && <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}<button type="submit" disabled={isPending || !token} className="mt-5 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{isPending ? "Mengaktifkan..." : "Aktifkan akun"}</button></form></main>;
}

export default function ActivatePage() { return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#070d12] text-slate-400">Memuat halaman aktivasi...</main>}><ActivateForm /></Suspense>; }
