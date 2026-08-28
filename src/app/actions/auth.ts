"use server";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, rateLimit } from "@/lib/security";
import { createHash } from "node:crypto";
import { z } from "zod";

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

    return signIn("credentials", {
      email: user.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    console.error("[activation] Member activation failed", error);
    return { success: false as const, error: "Aktivasi akun tidak dapat diproses." };
  }
}
