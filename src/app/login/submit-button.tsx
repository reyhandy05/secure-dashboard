"use client";

import { useState } from "react";
import { loginAction } from "@/app/actions/auth"; 

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Panggil server action
    const res = await loginAction({ email, password });

    // Jika res memiliki nilai, berarti ada error yang dikembalikan dari AuthError
    // (Jika login sukses, eksekusi kode di bawahnya tidak akan berjalan karena Next.js langsung me-redirect halaman)
    if (res?.error) {
      setError(res.error);
    }
  }

  // ... sisa JSX form
}