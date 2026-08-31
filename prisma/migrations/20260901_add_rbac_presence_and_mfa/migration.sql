-- AlterTable: RBAC role-change OTP, MFA setup OTP, presence tracking
ALTER TABLE "User"
  ADD COLUMN "roleOtpHash" TEXT,
  ADD COLUMN "roleOtpExpires" TIMESTAMP(3),
  ADD COLUMN "roleOtpTargetId" TEXT,
  ADD COLUMN "roleOtpNewRole" TEXT,
  ADD COLUMN "mfaOtpHash" TEXT,
  ADD COLUMN "mfaOtpExpires" TIMESTAMP(3),
  ADD COLUMN "lastSeenAt" TIMESTAMP(3);
