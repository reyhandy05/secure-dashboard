import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { loginOtpSchema } from "@/lib/validators";
import { isValidLoginOtp } from "@/lib/security";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: "auth_session",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      },
    },
  },
  providers: [Credentials({ credentials: { email: {}, code: {} }, async authorize(raw) {
    const parsed = loginOtpSchema.safeParse(raw);
    if (!parsed.success) return null;
    const now = new Date();
    const user = await prisma.user.findFirst({
      where: { email: parsed.data.email.toLowerCase(), accessStatus: "ACTIVE", loginOtpExpires: { gt: now } },
         select: { id: true, email: true, name: true, role: true, mfaEnabled: true, loginOtpHash: true },
      });
      if (!user?.loginOtpHash || !isValidLoginOtp(user.loginOtpHash, parsed.data.code)) return null;
      const consumed = await prisma.user.updateMany({
        where: { id: user.id, loginOtpHash: user.loginOtpHash, loginOtpExpires: { gt: now } },
        data: {
          loginOtpHash: null,
          loginOtpExpires: null,
          // A pending account is activated by its first valid login OTP.
          ...(user.mfaEnabled ? {} : { mfaEnabled: true }),
          lastSeenAt: now,
        },
      });
    if (consumed.count !== 1) return null;
    const role = user.role === "ADMIN" || user.role === "RESPONDER" || user.role === "VIEWER" ? user.role : "VIEWER";
    return { id: user.id, email: user.email, name: user.name, role };
  } })],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "RESPONDER" | "VIEWER";
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
});
