"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hashLoginOtp, rateLimit } from "@/lib/security";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import nodemailer from "nodemailer";

const OTP_TTL_MS = 10 * 60 * 1000;
const emailSchema = z.string().trim().email().max(254);
const otpSchema = z.string().trim().regex(/^\d{6}$/);
const transporter = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export async function sendLoginOtp(rawEmail: string) {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { success: false as const, error: "Masukkan alamat email yang valid." };
  const email = parsed.data.toLowerCase();
  const user = await prisma.user.findFirst({ where: { email, accessStatus: "ACTIVE" }, select: { id: true, email: true, name: true } });
  if (!user) return { success: false as const, error: "Email tidak terdaftar dalam akses tim." };
  if (!rateLimit(`login-otp:${hashInviteToken(email)}`, 3, OTP_TTL_MS).allowed) return { success: false as const, error: "Terlalu banyak permintaan kode. Coba lagi dalam 10 menit." };
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return { success: false as const, error: "Konfigurasi email server belum tersedia." };
  const code = randomInt(100000, 1_000_000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await prisma.user.update({ where: { id: user.id }, data: { loginOtpHash: hashLoginOtp(code), loginOtpExpires: expiresAt } });
  try {
    await transporter.sendMail({ from: `"Northstar Security" <${process.env.GMAIL_USER}>`, to: user.email, subject: "Kode masuk Northstar Security Console", text: `Kode verifikasi Anda: ${code}\n\nKode ini berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.`, html: `<div style="background:#020617;padding:32px 16px;font-family:Arial,sans-serif;color:#e2e8f0"><div style="max-width:520px;margin:auto;padding:32px;background:#0f172a;border:1px solid #1e293b;border-radius:16px"><p style="color:#34d399;font-size:11px;font-weight:bold;letter-spacing:2px">NORTHSTAR / SECURITY</p><h1 style="color:#f8fafc">Verifikasi akses Anda</h1><p style="color:#94a3b8">Halo ${escapeHtml(user.name ?? user.email)}, gunakan kode berikut untuk masuk:</p><div style="padding:18px;text-align:center;background:#020617;border:1px solid #334155;border-radius:8px;color:#6ee7b7;font-size:32px;font-weight:bold;letter-spacing:8px">${code}</div><p style="color:#94a3b8">Kode berlaku selama 10 menit. Jangan bagikan kode ini.</p></div></div>` });
    return { success: true as const };
  } catch (error) {
    await prisma.user.update({ where: { id: user.id }, data: { loginOtpHash: null, loginOtpExpires: null } });
    console.error("[login-otp] Failed to send OTP email", error);
    return { success: false as const, error: "Kode tidak dapat dikirim. Coba lagi nanti." };
  }
}

export async function verifyLoginOtp(rawEmail: string, rawCode: string) {
  const email = emailSchema.safeParse(rawEmail);
  const code = otpSchema.safeParse(rawCode);
  if (!email.success || !code.success) return { success: false as const, error: "Kode harus terdiri dari 6 digit." };

  try {
    await signIn("credentials", {
      email: email.data.toLowerCase(),
      code: code.data,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false as const, error: "Kode salah, kadaluarsa, atau akses tim tidak aktif." };
        default:
          return { success: false as const, error: "Terjadi kesalahan saat masuk." };
      }
    }
    throw error;
  }
}

// ==================== 2. ACTIVATE MEMBER ACTION ====================
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
