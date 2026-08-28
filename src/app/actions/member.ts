"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_WINDOW_MS = 30 * 1000;
const resendAttempts = new Map<string, number>();

function hashOtp(otp: string) {
  return createHash("sha256")
    .update(`${otp}:${process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "development-only"}`)
    .digest("hex");
}

function isValidOtp(storedHash: string, otp: string) {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashOtp(otp), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

async function requireAdmin() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      if (process.env.NODE_ENV !== "development") return null;

      const developmentAdmin = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true, email: true, role: true },
        orderBy: { createdAt: "asc" },
      });

      if (developmentAdmin) {
        console.warn("[member-delete] Using development admin fallback");
      }
      return developmentAdmin;
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, role: true },
    });

    if (!dbUser || dbUser.role !== "ADMIN") return null;
    return dbUser;
  } catch (error) {
    console.error("[member-delete] Admin session lookup failed", error);
    return null;
  }
}

export async function getMembers() {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: "Akses admin diperlukan." };

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        mfaEnabled: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true as const,
      data: users.map((user) => ({
        ...user,
        name: user.name ?? user.email,
        role: user.role === "ADMIN" ? "Administrator" : user.role === "RESPONDER" ? "Responder" : "Viewer",
        mfa: user.mfaEnabled ? "Enforced" as const : "Pending" as const,
        status: "Active" as const,
        initials: (user.name ?? user.email)
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      })),
    };
  } catch (error) {
    console.error("[members] Failed to load members", error);
    return { success: false as const, error: "Gagal memuat data member." };
  }
}

export async function requestDeleteMemberOTP(targetUserId: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false as const, error: "Akses admin diperlukan." };

  if (!targetUserId) {
    return { success: false, error: "Data member tidak valid." };
  }

  const lastRequest = resendAttempts.get(`${admin.id}:${targetUserId}`) ?? 0;
  if (Date.now() - lastRequest < RESEND_WINDOW_MS) {
    return { success: false, error: "Tunggu beberapa detik sebelum meminta OTP lagi." };
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return { success: false, error: "Member tidak ditemukan." };
    }
    if (targetUser.id === admin.id) {
      return { success: false, error: "Akun admin yang sedang digunakan tidak dapat dihapus." };
    }

    const sender = process.env.GMAIL_USER;
    const appPassword = process.env.GMAIL_APP_PASSWORD;
    if (!sender || !appPassword) {
      console.error("[member-delete] Gmail credentials are not configured");
      return { success: false, error: "Konfigurasi email server belum tersedia." };
    }

    const otp = randomInt(100000, 1000000).toString();
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        deleteOtpHash: hashOtp(otp),
        deleteOtpExpires: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const safeTargetName = escapeHtml(targetUser.name ?? targetUser.email);
    const info = await transporter.sendMail({
      from: `"Northstar Dashboard" <${sender}>`,
      to: admin.email,
      subject: `[Security Alert] Otorisasi Penghapusan Member: ${targetUser.name || targetUser.email}`,
      text: `Halo Admin.\n\nMasukkan kode verifikasi berikut untuk mengonfirmasi penghapusan akun member: ${targetUser.email}\n\nKode OTP: ${otp}\n\nKode ini berlaku selama 10 menit. Jika Anda tidak memulai permintaan ini, abaikan email ini dan amankan akun Anda.`,
      html: `<div style="background:#050b10;padding:32px 16px;font-family:Arial,sans-serif;color:#e2e8f0"><div style="max-width:520px;margin:auto;padding:32px;background:#0b151c;border:1px solid #1f3440;border-radius:14px"><p style="color:#34d399;font-size:11px;font-weight:bold;letter-spacing:2px">NORTHSTAR / SECURITY</p><h1 style="color:#f8fafc;font-size:24px">Otorisasi penghapusan member</h1><p style="color:#a8b8c2;line-height:1.7">Halo Admin, masukkan kode verifikasi berikut untuk mengonfirmasi penghapusan akun member <strong style="color:#f8fafc">${safeTargetName}</strong> (${escapeHtml(targetUser.email)}):</p><div style="padding:18px;text-align:center;background:#101f28;border:1px solid #284452;border-radius:8px;color:#67e8f9;font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</div><p style="color:#a8b8c2;line-height:1.7">Kode ini berlaku selama 10 menit. Jika Anda tidak memulai permintaan ini, abaikan email ini dan amankan akun Anda.</p><hr style="border:0;border-top:1px solid #1f3440"><p style="color:#607784;font-size:11px">Email keamanan otomatis dari Northstar Security Console.</p></div></div>`,
    });

    resendAttempts.set(`${admin.id}:${targetUserId}`, Date.now());
    console.log("[member-delete] OTP sent to admin", { targetUserId, adminEmail: admin.email, messageId: info.messageId });
    return { success: true as const, targetEmail: targetUser.email, adminEmail: admin.email };
  } catch (error) {
    console.error("[member-delete] OTP request failed", error);
    return { success: false, error: "OTP tidak dapat dikirim." };
  }
}

export async function verifyAndDeleteMember(targetUserId: string, otpInput: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Akses admin diperlukan." };
  if (!targetUserId || !/^\d{6}$/.test(otpInput)) return { success: false, error: "Kode OTP harus terdiri dari 6 digit." };

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    const adminWithOtp = await prisma.user.findUnique({ where: { id: admin.id } });
    if (!targetUser || targetUser.id === admin.id) return { success: false, error: "Member tidak ditemukan." };
    if (!adminWithOtp?.deleteOtpHash || !adminWithOtp.deleteOtpExpires || adminWithOtp.deleteOtpExpires <= new Date()) {
      return { success: false, error: "OTP sudah kadaluarsa. Kirim ulang OTP." };
    }
    if (!isValidOtp(adminWithOtp.deleteOtpHash, otpInput)) {
      return { success: false, error: "Kode OTP salah." };
    }

    await prisma.$transaction([
      prisma.user.delete({ where: { id: targetUser.id } }),
      prisma.user.update({ where: { id: admin.id }, data: { deleteOtpHash: null, deleteOtpExpires: null } }),
    ]);
    revalidatePath("/");
    console.log("[member-delete] Member deleted", { targetUserId: targetUser.id });
    return { success: true };
  } catch (error) {
    console.error("[member-delete] Member deletion failed", error);
    return { success: false, error: "Member tidak dapat dihapus." };
  }
}