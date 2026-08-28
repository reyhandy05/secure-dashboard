import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  totpCode: z.string().trim().regex(/^\d{6}$/).optional(),
}).strict();

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
}).strict();

export const incidentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  asset: z.string().trim().regex(/^[A-Z0-9._-]{2,80}$/),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
