'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/security';
import nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

async function requireAdmin() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      if (process.env.NODE_ENV !== 'development') return null;

      const developmentAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true, email: true, role: true },
        orderBy: { createdAt: 'asc' },
      });

      if (developmentAdmin) {
        console.warn('[invite] Using development admin fallback');
      }
      return developmentAdmin;
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, role: true },
    });

    if (!dbUser || dbUser.role !== 'ADMIN') return null;
    return dbUser;
  } catch (error) {
    console.error('[invite] Admin session lookup failed', error);
    return null;
  }
}

function mapRole(role: string) {
  switch (role.trim().toLowerCase()) {
    case 'administrator':
    case 'administrator (full access)':
    case 'admin':
      return 'ADMIN';
    case 'security operator':
    case 'responder':
      return 'RESPONDER';
    case 'viewer':
      return 'VIEWER';
    default:
      return null;
  }
}

function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function sendInviteEmail(formData: FormData) {
  const session = await requireAdmin();
  if (!session) return { success: false as const, error: 'Akses ditolak: Hanya admin yang dapat mengundang member.' };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const role = String(formData.get('role') ?? 'Viewer').trim() || 'Viewer';
  const databaseRole = mapRole(role);

  console.log('[invite] Received form data', { name, email, role });

  if (!email || !name || !databaseRole || !/^\S+@\S+\.\S+$/.test(email)) {
    console.log('[invite] Input validation failed');
    return { success: false as const, error: 'Mohon isi nama dan alamat email dengan format yang benar.' };
  }

  const sender = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!sender || !appPassword) {
    console.error('[invite] Gmail SMTP credentials are not configured');
    return { success: false, error: 'Konfigurasi email server belum tersedia.' };
  }

  console.log('[invite] Input validation passed; creating member');

  let createdUser: { id: string; name: string | null; email: string; role: string } | null = null;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return { success: false as const, error: 'Email ini sudah terdaftar sebagai member aktif.' };

    const temporaryPasswordHash = await hashPassword(randomBytes(32).toString('base64url'));
    const inviteToken = randomBytes(32).toString('hex');
    createdUser = await prisma.user.create({
      data: {
        name,
        email,
        role: databaseRole,
        passwordHash: temporaryPasswordHash,
        mfaEnabled: false,
        inviteTokenHash: hashInviteToken(inviteToken),
        inviteTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'http://localhost:3000';
    const activationUrl = `${baseUrl}/auth/activate?token=${inviteToken}`;
    const safeName = escapeHtml(name);
    const safeRole = escapeHtml(role);
    const safeActivationUrl = escapeHtml(activationUrl);
    const text = `
Halo, ${name}.

Anda diundang untuk bergabung ke Northstar Security Console dengan role ${role}.

Untuk mengonfirmasi undangan dan memulai aktivasi akun, buka:
${activationUrl}

Jika Anda tidak mengenal pengirim atau tidak mengharapkan undangan ini, abaikan email ini.

Email ini dikirim ke ${email} oleh Northstar Security Console.
Pesan ini dibuat dan dikirim otomatis. Mohon jangan membalas email ini.
    `.trim();

    const info = await transporter.sendMail({
      from: `"Northstar Dashboard" <${sender}>`,
      to: email,
      subject: 'Akses Akun: Undangan Bergabung ke Northstar Security',
      text,
      html: `
        <div style="margin:0; padding:32px 16px; background:#050b10; font-family:Arial,Helvetica,sans-serif; color:#e2e8f0;">
          <div style="max-width:540px; margin:0 auto; padding:32px; background:#0b151c; border:1px solid #1f3440; border-radius:14px;">
            <p style="margin:0 0 24px; color:#34d399; font-size:11px; font-weight:bold; letter-spacing:2px;">NORTHSTAR / SECURITY</p>
            <h1 style="margin:0 0 16px; color:#f8fafc; font-size:24px;">Halo, ${safeName}.</h1>
            <p style="color:#a8b8c2; font-size:14px; line-height:1.7;">Anda diundang untuk bergabung ke Northstar Security Console dengan akses berikut:</p>
            <div style="margin:24px 0; padding:16px; background:#101f28; border:1px solid #284452; border-radius:8px;">
              <p style="margin:0 0 6px; color:#78909c; font-size:11px; text-transform:uppercase; letter-spacing:1px;">Access role</p>
              <strong style="color:#67e8f9; font-size:16px;">${safeRole}</strong>
            </div>
            <p style="color:#a8b8c2; font-size:14px; line-height:1.7;">Gunakan tombol berikut untuk mengonfirmasi undangan dan memulai aktivasi akun Anda.</p>
            <p style="margin:28px 0; text-align:center;"><a href="${safeActivationUrl}" style="display:inline-block; padding:13px 22px; background:#34d399; color:#042f2e; text-decoration:none; border-radius:7px; font-weight:bold; font-size:14px;">Aktivasi Akun</a></p>
            <p style="color:#78909c; font-size:12px; line-height:1.6;">Jika tombol tidak dapat digunakan, buka alamat berikut di browser Anda:<br /><a href="${safeActivationUrl}" style="color:#67e8f9; word-break:break-all;">${safeActivationUrl}</a></p>
            <hr style="border:0; border-top:1px solid #1f3440; margin:24px 0;" />
            <p style="margin:0; color:#607784; font-size:11px; line-height:1.5;">Email ini dikirim ke ${escapeHtml(email)} oleh Northstar Security Console. Pesan ini dibuat dan dikirim otomatis. Jika Anda tidak mengharapkan undangan ini, abaikan email ini.</p>
          </div>
        </div>
      `,
    });

    console.log('[invite] Email sent successfully', { messageId: info.messageId, userId: createdUser.id });
    revalidatePath('/');
    return { success: true as const, data: createdUser };
  } catch (error) {
    console.error('[invite] Nodemailer send failed', error);
    if (createdUser) {
      try {
        await prisma.user.delete({ where: { id: createdUser.id } });
      } catch (cleanupError) {
        console.error('[invite] Failed to rollback created member', cleanupError);
      }
    }
    return { success: false as const, error: 'Gagal membuat akun atau mengirim email undangan.' };
  }
}