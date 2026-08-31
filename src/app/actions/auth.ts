"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, rateLimit } from "@/lib/security";
import { createHash } from "node:crypto";
import { z } from "zod";

// ==================== LOGIN ACTION ====================
export async function loginAction(credentials: { email: string; password: string }) {
  try {
    await signIn("credentials", {
      email: credentials.email,
      password: credentials.password,
      redirectTo: "/", // arahkan ke dashboard
    });
  } catch (error) {
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
    // Wajib lempar ulang error agar Next.js redirect berjalan lancar
    throw error;
  }
}

// ==================== ACTIVATE MEMBER ACTION ====================
const activationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  password: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/).regex(/[^A-Za-z\d]/),
});

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function activateInvitedMember(token: string, password: string) {
  const parsed = activationSchema.safeParse({ token, password });
  if (!parsed.success) {
    return { success: false as const, error: "Link aktivasi atau password tidak valid." };
  }

  const limit = rateLimit(`activation:${hashInviteToken(token)}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return { success: false as const, error: "Terlalu banyak percobaan. Coba lagi nanti." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { inviteTokenHash: hashInviteToken(token) },
      select: { id: true, email: true, inviteTokenExpires: true },
    });

    if (!user || !user.inviteTokenExpires || user.inviteTokenExpires <= new Date()) {
      return { success: false as const, error: "Link aktivasi sudah tidak berlaku." };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        inviteTokenHash: null,
        inviteTokenExpires: null,
        inviteAcceptedAt: new Date(),
      },
    });

    await signIn("credentials", {
      email: user.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false as const, error: "Gagal login otomatis setelah aktivasi." };
    }
    throw error;
  }
}