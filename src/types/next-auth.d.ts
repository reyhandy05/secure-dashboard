import "next-auth";
declare module "next-auth" {
  interface Session { user: { id: string; role: "ADMIN" | "RESPONDER" | "VIEWER" } & DefaultSession["user"] }
  interface User { role: "ADMIN" | "RESPONDER" | "VIEWER" }
}
