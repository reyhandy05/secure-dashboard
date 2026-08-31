"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";
import { sendLoginOtp, verifyLoginOtp } from "@/app/actions/auth";
import SubmitButton from "./submit-button";

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!countdown) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  async function requestCode() {
    setError(null); setNotice(null);
    const result = await sendLoginOtp(email);
    if (!result.success) { setError(result.error); return; }
    setCode(""); setStep("code"); setCountdown(60);
    setNotice("Kode verifikasi telah dikirim. Kode berlaku selama 10 menit.");
  }
  async function resendCode() { if (countdown || resending) return; setResending(true); await requestCode(); setResending(false); }
  async function verifyCode() {
    // Verifikasi tidak boleh mewarisi notifikasi dari request/resend OTP.
    setError(null);
    setNotice(null);

    try {
      const result = await verifyLoginOtp(email, code);
      if (result && !result.success) setError(result.error);
    } catch {
      setError("Verifikasi kode tidak dapat diproses. Coba lagi.");
    }
  }
  function changeEmail() { setStep("email"); setCode(""); setError(null); setNotice(null); setCountdown(0); }

  return <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-slate-100">
    <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
      <div className="mb-8 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"><ShieldCheck size={19} /></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-emerald-400">Northstar</p><p className="text-sm font-semibold text-white">Security Console</p></div></div>
      <h1 className="text-2xl font-semibold tracking-[-.03em] text-white">{step === "email" ? "Sign in securely" : "Verify your code"}</h1>
      <p className="mt-2 text-sm text-slate-400">{step === "email" ? "Enter your team email to receive a secure verification code." : `We sent a 6-digit code to ${email}.`}</p>
      {error && <div role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>}
      {notice && <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-300">{notice}</div>}
      {step === "email" ? <form className="mt-7 space-y-4" action={requestCode}><label className="block text-xs font-semibold text-slate-400">Email<input className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required autoFocus /></label><SubmitButton idleLabel="Kirim Kode Verifikasi" pendingLabel="Mengirim kode..." /></form> : <form className="mt-7 space-y-4" action={verifyCode}><label className="block text-xs font-semibold text-slate-400">Secret verification code<input className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 text-center font-mono text-xl tracking-[.45em] text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" type="text" inputMode="numeric" pattern="[0-9]{6}" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); setNotice(null); }} autoComplete="one-time-code" maxLength={6} required autoFocus /></label><SubmitButton idleLabel="Verifikasi & Masuk" pendingLabel="Memverifikasi..." /></form>}
      {step === "code" && <div className="mt-5 flex items-center justify-between text-xs"><button type="button" onClick={changeEmail} className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200"><ArrowLeft className="size-3" />Ganti Email</button><button type="button" onClick={resendCode} disabled={countdown > 0 || resending} className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-slate-600"><MailCheck className="size-3" />{resending ? "Mengirim..." : countdown > 0 ? `Kirim ulang (${countdown}s)` : "Kirim Ulang"}</button></div>}
      <p className="mt-6 text-center text-xs text-slate-400">Access is monitored and recorded. <Link href="/" className="font-semibold text-emerald-400 hover:text-emerald-300">System status</Link></p>
    </section>
  </main>;
}
