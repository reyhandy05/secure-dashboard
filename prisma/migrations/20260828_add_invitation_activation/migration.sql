ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "inviteTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "inviteTokenExpires" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "inviteAcceptedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteTokenHash_key"
  ON "User" ("inviteTokenHash");
