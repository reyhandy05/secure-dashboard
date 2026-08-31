"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(credentials: { email: string; password: string }) {
  try {
    // signIn secara default akan melempar error NEXT_REDIRECT jika berhasil
    await signIn("credentials", {
      email: credentials.email,
      password: credentials.password,
      redirectTo: "/dashboard", // Sesuaikan dengan halaman tujuan utama kamu
    });
  } catch (error) {
    // 1. Tangani error yang murni berasal dari NextAuth (seperti password salah)
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Email atau password yang kamu masukkan salah." };
        case "AccessDenied":
          return { error: "Akses ditolak. Akun kamu mungkin belum aktif." };
        default:
          return { error: "Terjadi kesalahan pada sistem autentikasi." };
      }
    }
    
    // 2. WAJIB ADA: Lempar ulang error selain AuthError.
    // Jika tidak dilempar ulang, halaman akan stuck dan tidak mau redirect.
    throw error;
  }
}