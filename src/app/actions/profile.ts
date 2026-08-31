"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, rateLimit, verifyPassword } from "@/lib/security";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(50).transform((value) => value.replace(/[<>]/g, "")),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/).regex(/[^A-Za-z\d]/),
  confirmPassword: z.string().min(1),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "Konfirmasi password tidak cocok.",
  path: ["confirmPassword"],
});

async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.email) {
    if (process.env.NODE_ENV !== "development") return null;
    return prisma.user.findUnique({
      where: { email: process.env.DEV_ADMIN_EMAIL ?? "reyhandy05@gmail.com" },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
  }
  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
}

export async function updateUserProfile(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false as const, error: "Sesi tidak valid." };
    const parsed = profileSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) return { success: false as const, error: "Nama harus diisi dan maksimal 50 karakter." };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, email: true },
    });
    revalidatePath("/");
    return { success: true as const, user: updated };
  } catch (error) {
    console.error("[profile] Profile update failed", error);
    return { success: false as const, error: "Profil tidak dapat diperbarui." };
  }
}

export async function updateUserPassword(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false as const, error: "Sesi tidak valid." };
    const parsed = passwordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) return { success: false as const, error: "Password baru minimal 8 karakter dan harus mengandung huruf, angka, serta simbol." };
    const limit = rateLimit(`password:${user.id}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) return { success: false as const, error: "Terlalu banyak percobaan. Coba lagi nanti." };
    if (!(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
      return { success: false as const, error: "Password lama tidak valid." };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });
    revalidatePath("/");
    return { success: true as const };
  } catch (error) {
    console.error("[profile] Password update failed", error);
    return { success: false as const, error: "Password tidak dapat diperbarui." };
  }
}

export async function getActiveSessionIp() {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwardedFor || requestHeaders.get("x-real-ip")?.trim();
    return { success: true as const, ip: ip || "::1 / 127.0.0.1" };
  } catch (error) {
    console.error("[profile] Failed to detect session IP", error);
    return { success: false as const, ip: "Tidak tersedia" };
  }
}

export async function getCurrentUserProfile() {
  const session = await auth();
  if (!session?.user?.email) return { success: false as const, error: "Sesi tidak valid." };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { name: true, email: true, role: true },
  });
  if (!user) return { success: false as const, error: "Profil pengguna tidak ditemukan." };

  return {
    success: true as const,
    user: { name: user.name ?? user.email, email: user.email, role: user.role },
  };
}
