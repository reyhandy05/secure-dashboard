"use server";

import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashIp, hashPassword, rateLimit } from "@/lib/security";
import { incidentSchema, registerSchema, loginSchema } from "@/lib/validators";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

async function requireSession() {
  try {
    const session = await auth();
    if (session?.user?.id) return session;
    if (process.env.NODE_ENV !== "development") return null;

    const developmentAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true, email: true, name: true, role: true },
      orderBy: { createdAt: "asc" },
    });

    if (!developmentAdmin) return null;
    console.warn("[actions] Using development admin fallback");
    return {
      user: {
        id: developmentAdmin.id,
        email: developmentAdmin.email,
        name: developmentAdmin.name,
        role: "ADMIN" as const,
      },
    };
  } catch (error) {
    console.error("Session lookup failed", error);
    return null;
  }
}

export async function getIncidents() {
  const session = await requireSession();
  if (!session) return [];

  try {
    return await prisma.incident.findMany({
      where: { status: { not: "Resolved" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        incidentId: true,
        title: true,
        asset: true,
        owner: true,
        severity: true,
        status: true,
        time: true,
        createdAt: true,
        createdByUserId: true,
      },
    });
  } catch (error) {
    console.error("Failed to load incidents", error);
    return [];
  }
}

export async function createIncident(formData: FormData): Promise<
  | { success: true; incident: {
      id: string;
      incidentId: string | null;
      title: string;
      asset: string;
      owner: string;
      severity: string;
      status: string;
      time: string | null;
      createdByUserId: string | null;
    } }
  | { success: false; error: string }
> {
  try {
    const session = await requireSession();
    if (!session || !session.user?.id) {
      return { success: false, error: "Sesi login diperlukan." };
    }

    const parsed = incidentSchema.safeParse({
      title: String(formData.get("title") ?? "").trim(),
      asset: String(formData.get("asset") ?? "").trim().toUpperCase(),
      severity: String(formData.get("severity") ?? "Medium"),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Judul insiden, aset terdampak, dan severity tidak valid.",
      };
    }

    const incident = await prisma.incident.create({
      data: {
        ...parsed.data,
        createdByUserId: session.user.id,
        incidentId: `INC-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`,
        owner: session.user.name ?? "SOC Lead",
      },
      select: {
        id: true,
        incidentId: true,
        title: true,
        asset: true,
        owner: true,
        severity: true,
        status: true,
        time: true,
        createdByUserId: true,
      },
    });

    revalidatePath("/");
    revalidatePath("/incidents");

    return { success: true, incident };
  } catch (error) {
    console.error("Failed to create incident", error);
    return { success: false, error: "Insiden tidak dapat dibuat." };
  }
}

export async function resolveIncident(id: string) {
  const session = await requireSession();
  if (!session) return { ok: false as const, message: "Sesi login diperlukan." };
  if (!zodId(id)) return { ok: false as const, message: "Insiden tidak valid." };

  try {
    await prisma.incident.update({ where: { id }, data: { status: "Resolved", time: "Resolved just now" } });
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    console.error("Failed to resolve incident", error);
    return { ok: false as const, message: "Insiden tidak dapat diselesaikan." };
  }
}

export async function deleteIncident(incidentId: string) {
  const session = await requireSession();
  if (!session) return { success: false as const, error: "Sesi login diperlukan." };
  if (!zodId(incidentId)) return { success: false as const, error: "Insiden tidak valid." };

  try {
    await prisma.incident.delete({ where: { id: incidentId } });
    revalidatePath("/");
    return { success: true as const };
  } catch (error) {
    console.error("Failed to delete incident", error);
    return { success: false as const, error: "Insiden tidak dapat dihapus." };
  }
}

function zodId(value: string) {
  return typeof value === "string" && value.length > 0 && value.length <=  cuidMaxLength;
}

const cuidMaxLength = 40;

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip") ?? "unknown";
  const limit = rateLimit(`login:${hashIp(ip)}:${parsed.data.email.toLowerCase()}`);
  if (!limit.allowed) return;

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/" });
  } catch (error) {
    console.error("Login failed", error);
    return;
  }
}

export async function logoutAction() {
  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({ where: { id: session.user.id }, data: { lastSeenAt: null } }).catch((error) => {
      console.error("[presence] Failed to mark user offline", error);
    });
  }
  await signOut({ redirectTo: "/login" });
}

export async function registerAction(formData: FormData) {
  const limit = rateLimit(`register:${formData.get("email") ?? "unknown"}`);
  if (!limit.allowed) return { ok: false, message: "Terlalu banyak percobaan. Coba lagi nanti." };
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Data pendaftaran tidak valid." };
  try {
    const email = parsed.data.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return { ok: false, message: "Tidak dapat membuat akun dengan data tersebut." };
    await prisma.user.create({
      data: { name: parsed.data.name, email, passwordHash: await hashPassword(parsed.data.password) },
    });
    await signIn("credentials", { email, password: parsed.data.password, redirectTo: "/" });
    return { ok: true };
  } catch (error) {
    console.error("Registration failed", error);
    return { ok: false, message: "Permintaan tidak dapat diproses." };
  }
}
