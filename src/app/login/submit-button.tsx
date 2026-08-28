"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
      type="submit"
      disabled={pending}
    >
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
      {pending ? "Authenticating..." : "Continue"}
    </button>
  );
}
