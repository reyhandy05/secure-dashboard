import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { verifyPassword } from "@/lib/security";

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
  providers: [Credentials({ credentials: { email: {}, password: {}, totpCode: {} }, async authorize(raw) {
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) return null;
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) return null;
    if (user.mfaEnabled && parsed.data.totpCode !== "000000") return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role === "ADMIN" ? "ADMIN" : "USER" };
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
        session.user.role = token.role as "ADMIN" | "USER";
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
});
