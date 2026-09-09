"use server";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashLoginOtp, rateLimit } from "@/lib/security";
import { AuthError } from "next-auth";
import { createHash, randomInt } from "node:crypto";
import { Resend } from "resend";
import { z } from "zod";

const OTP_TTL_MS = 10 * 60 * 1000;
const emailSchema = z.string().trim().email().max(254);
const otpSchema = z.string().trim().regex(/^\d{6}$/);
const resend = new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);

export async function sendLoginOtp(rawEmail: string): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { success: false, error: "Masukkan alamat email yang valid." };
  }

  const email = parsed.data.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email, accessStatus: "ACTIVE" },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return { success: false, error: "Email tidak terdaftar dalam akses tim." };
  }

  const rateLimitKey = `login-otp:${createHash("sha256").update(email).digest("hex")}`;
  const limit = rateLimit(rateLimitKey, 5, OTP_TTL_MS);
  if (!limit.allowed) {
    return { success: false, error: "Terlalu banyak permintaan kode. Coba lagi dalam 10 menit." };
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY belum diatur di lingkungan runtime." };
  }

  const code = randomInt(100000, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginOtpHash: hashLoginOtp(code),
      loginOtpExpires: expiresAt,
    },
  });

  try {
    const response = await resend.emails.send({
      from: "Northstar Security <onboarding@resend.dev>",
      to: [user.email],
      subject: "Kode masuk Northstar Security Console",
      text: `Kode verifikasi Anda: ${code}\n\nKode ini berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.`,
      html: `
        <div style="background:#020617;padding:32px 16px;font-family:Arial,sans-serif;color:#e2e8f0;">
          <div style="max-width:520px;margin:auto;padding:32px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;">
            <p style="color:#34d399;font-size:11px;font-weight:bold;letter-spacing:2px;">NORTHSTAR / SECURITY</p>
            <h1 style="color:#f8fafc;">Verifikasi akses Anda</h1>
            <p style="color:#94a3b8;">Halo ${escapeHtml(user.name ?? user.email)}, gunakan kode berikut untuk masuk:</p>
            <div style="padding:18px;text-align:center;background:#020617;border:1px solid #334155;border-radius:8px;color:#6ee7b7;font-size:32px;font-weight:bold;letter-spacing:8px;">${code}</div>
            <p style="color:#94a3b8;">Kode berlaku selama 10 menit. Jangan bagikan kode ini.</p>
          </div>
        </div>
      `,
    });

    if (response.error) {
      throw new Error(response.error.message ?? "Resend returned an unknown error.");
    }

    return { success: true };
  } catch (error: unknown) {
    await prisma.user.update({
      where: { id: user.id },
      data: { loginOtpHash: null, loginOtpExpires: null },
    });

    const resendError = error instanceof Error ? error : new Error("Unknown Resend delivery error");
    return { success: false, error: resendError.message };
  }
}

export async function verifyLoginOtp(rawEmail: string, rawCode: string): Promise<{ success: true } | { success: false; error: string }> {
  const emailResult = emailSchema.safeParse(rawEmail);
  const codeResult = otpSchema.safeParse(rawCode);

  if (!emailResult.success || !codeResult.success) {
    return { success: false, error: "Kode harus terdiri dari 6 digit." };
  }

  try {
    await signIn("credentials", {
      email: emailResult.data.toLowerCase(),
      code: codeResult.data,
      redirect: false,
    });
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return { success: false, error: "Kode salah atau telah kedaluwarsa." };
    }

    throw error;
  }
}

const activationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
});

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function activateInvitedMember(token: string) {
  const parsed = activationSchema.safeParse({ token });
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        inviteTokenHash: null,
        inviteTokenExpires: null,
        inviteAcceptedAt: new Date(),
        accessStatus: "ACTIVE",
      },
    });
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false as const, error: "Gagal login otomatis setelah aktivasi." };
    }
    throw error;
  }
}