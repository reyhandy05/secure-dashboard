"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { incidentSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";

type IncidentUser = {
  id: string;
  name: string | null;
  email: string;
};

type IncidentWithUser = {
  id: string;
  incidentId: string | null;
  title: string;
  asset: string;
  owner: string;
  severity: string;
  status: string;
  time: string | null;
  userId: string | null;
  user: IncidentUser | null;
};

async function requireSession(): Promise<{
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string;
  };
} | null> {
  try {
    const session = await auth();
    if (session?.user?.id) {
      return session;
    }

    if (process.env.NODE_ENV !== "development") {
      return null;
    }

    const developmentAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true, email: true, name: true, role: true },
      orderBy: { createdAt: "asc" },
    });

    if (!developmentAdmin) {
      return null;
    }

    return {
      user: {
        id: developmentAdmin.id,
        email: developmentAdmin.email,
        name: developmentAdmin.name,
        role: developmentAdmin.role,
      },
    };
  } catch (error) {
    console.error("[incident] Session lookup failed", error);
    return null;
  }
}

export async function getIncidents(): Promise<IncidentWithUser[]> {
  const session = await requireSession();
  if (!session) {
    return [];
  }

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
        userId: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  } catch (error) {
    console.error("[incident] Failed to load incidents", error);
    return [];
  }
}

export async function createIncident(formData: FormData): Promise<
  | { success: true; incident: IncidentWithUser }
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
        error:
          parsed.error.issues[0]?.message ??
          "Judul insiden, aset terdampak, dan severity tidak valid.",
      };
    }

    const incident = await prisma.incident.create({
      data: {
        title: parsed.data.title,
        asset: parsed.data.asset,
        severity: parsed.data.severity,
        userId: session.user.id,
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
        userId: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    revalidatePath("/");
    revalidatePath("/incidents");

    return { success: true, incident };
  } catch (error) {
    console.error("[incident] Failed to create incident", error);
    return { success: false, error: "Insiden tidak dapat dibuat." };
  }
}
