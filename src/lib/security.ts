import argon2 from "argon2";
import { createHash } from "node:crypto";
import { isIP } from "node:net";

const attempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_LIMIT = 5;
const WINDOW_MS = 15 * 60_000;

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}
export function rateLimit(key: string, limit = AUTH_LIMIT, windowMs = WINDOW_MS) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + windowMs }); return { allowed: true, remaining: limit - 1 }; }
  if (current.count >= limit) return { allowed: false, remaining: 0, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  current.count += 1;
  return { allowed: true, remaining: limit - current.count };
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  const expected = new URL(request.url).origin;
  if (!origin || new URL(origin).origin !== expected) throw new Error("Invalid request origin");
}
export function hashIp(ip: string) { return createHash("sha256").update(`${ip}:${process.env.IP_HASH_SALT ?? "development-only"}`).digest("hex"); }

export function isSafeRemoteUrl(value: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return false;
  if (url.hostname === "localhost" || url.hostname.endsWith(".local") || url.hostname === "metadata.google.internal") return false;
  const version = isIP(url.hostname);
  if (!version) return true;
  const octets = url.hostname.split(".").map(Number);
  return !(version === 4 && (octets[0] === 10 || octets[0] === 127 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)));
}
