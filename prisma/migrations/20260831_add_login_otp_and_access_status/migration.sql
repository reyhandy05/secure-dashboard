ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "accessStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "loginOtpHash" TEXT,
  ADD COLUMN IF NOT EXISTS "loginOtpExpires" TIMESTAMP(3);

-- Existing accounts predate accessStatus and remain active. New invitations
-- explicitly use INVITED until their activation link is confirmed.
